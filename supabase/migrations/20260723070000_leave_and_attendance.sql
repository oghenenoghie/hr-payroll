-- Leave & Attendance (People Operations pillar, third slice). An employee
-- requests leave from self-service; admin/HR — leave sits in HR's
-- documented scope, not payroll's — approve or reject it. Approving
-- 'annual' leave decrements the employee's balance atomically (blocked if
-- the balance can't cover it); 'unpaid' leave never touches the balance
-- but is deducted from gross pay (and re-taxed) through the next pay run,
-- because those days genuinely weren't earned.
alter table public.employees
  add column annual_leave_balance_days numeric not null default 20;

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null check (leave_type in ('annual', 'unpaid')),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  days integer not null check (days > 0 and days = (end_date - start_date + 1)),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  requested_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  paid_pay_run_id uuid references public.pay_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Only unpaid leave is ever "paid" (deducted through a run) — annual
  -- leave has no pay impact, so that transition is unrepresentable.
  constraint leave_requests_paid_status_requires_unpaid_type check (
    status <> 'paid' or leave_type = 'unpaid'
  )
);

create index leave_requests_org_id_idx on public.leave_requests (org_id);
create index leave_requests_employee_id_idx on public.leave_requests (employee_id);

alter table public.leave_requests enable row level security;

create policy "employees can view their own leave requests"
on public.leave_requests for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and HR can view all leave requests"
on public.leave_requests for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "employees can request leave for themselves"
on public.leave_requests for insert
to authenticated
with check (
  status = 'pending'
  and requested_by = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and HR can update leave requests"
on public.leave_requests for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Thin-writer RPC (security invoker — grants no privilege the caller
-- doesn't already have via the policies above): approving 'annual' leave
-- and decrementing the balance must be atomic, or a crash between the two
-- writes could grant leave that was never actually deducted.
create or replace function public.review_leave_request(p_leave_request_id uuid, p_approve boolean)
returns public.leave_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_leave public.leave_requests;
begin
  if p_approve then
    update public.leave_requests
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_leave_request_id and status = 'pending'
    returning * into v_leave;

    if v_leave.id is null then
      raise exception 'Leave request % not found, not pending, or you do not have permission to review it', p_leave_request_id;
    end if;

    if v_leave.leave_type = 'annual' then
      update public.employees
      set annual_leave_balance_days = annual_leave_balance_days - v_leave.days
      where id = v_leave.employee_id and annual_leave_balance_days >= v_leave.days;

      if not found then
        raise exception 'Employee has insufficient annual leave balance for this request';
      end if;
    end if;
  else
    update public.leave_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_leave_request_id and status = 'pending'
    returning * into v_leave;

    if v_leave.id is null then
      raise exception 'Leave request % not found, not pending, or you do not have permission to review it', p_leave_request_id;
    end if;
  end if;

  return v_leave;
end;
$$;

revoke all on function public.review_leave_request(uuid, boolean) from public;
grant execute on function public.review_leave_request(uuid, boolean) to authenticated;

-- Extends create_pay_run (same atomic-writer pattern as the loan and
-- expense extensions) to accept an optional payload.leave_deductions
-- array: [{leave_request_id, employee_id}]. Each is atomically flipped to
-- 'paid' and linked to this pay run — only from approved unpaid leave, so
-- a request can never be deducted twice or deducted before it's approved.
create or replace function public.create_pay_run(payload jsonb)
returns public.pay_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid := (payload->>'org_id')::uuid;
  v_pay_run public.pay_runs;
  v_journal_entry_id uuid;
  v_employee jsonb;
  v_posting jsonb;
  v_repayment jsonb;
  v_expense jsonb;
  v_leave jsonb;
  v_new_outstanding bigint;
  v_paid_expense_id uuid;
  v_paid_leave_id uuid;
begin
  insert into public.pay_runs (
    org_id, period_start, period_end, frequency, rule_version_id,
    employee_count, gross_kobo, net_kobo, created_by
  )
  values (
    v_org_id,
    (payload->>'period_start')::date,
    (payload->>'period_end')::date,
    payload->>'frequency',
    payload->>'rule_version_id',
    (payload->>'employee_count')::integer,
    (payload->>'gross_kobo')::bigint,
    (payload->>'net_kobo')::bigint,
    auth.uid()
  )
  returning * into v_pay_run;

  insert into public.journal_entries (org_id, pay_run_id, memo, entry_date)
  values (v_org_id, v_pay_run.id, payload->>'memo', (payload->>'period_end')::date)
  returning id into v_journal_entry_id;

  for v_employee in select * from jsonb_array_elements(payload->'payslips')
  loop
    insert into public.payslips (
      pay_run_id, employee_id, org_id, gross_kobo, pensionable_kobo,
      pension_employee_kobo, pension_employer_kobo, nhf_kobo, rent_relief_kobo,
      chargeable_income_kobo, paye_kobo, employee_deductions_kobo, net_kobo,
      cumulative_chargeable_income_before_kobo, cumulative_paye_paid_before_kobo,
      taxable_reimbursement_kobo, non_taxable_reimbursement_kobo
    )
    values (
      v_pay_run.id,
      (v_employee->>'employee_id')::uuid,
      v_org_id,
      (v_employee->>'gross_kobo')::bigint,
      (v_employee->>'pensionable_kobo')::bigint,
      (v_employee->>'pension_employee_kobo')::bigint,
      (v_employee->>'pension_employer_kobo')::bigint,
      (v_employee->>'nhf_kobo')::bigint,
      (v_employee->>'rent_relief_kobo')::bigint,
      (v_employee->>'chargeable_income_kobo')::bigint,
      (v_employee->>'paye_kobo')::bigint,
      (v_employee->>'employee_deductions_kobo')::bigint,
      (v_employee->>'net_kobo')::bigint,
      (v_employee->>'cumulative_chargeable_income_before_kobo')::bigint,
      (v_employee->>'cumulative_paye_paid_before_kobo')::bigint,
      coalesce((v_employee->>'taxable_reimbursement_kobo')::bigint, 0),
      coalesce((v_employee->>'non_taxable_reimbursement_kobo')::bigint, 0)
    );

    for v_posting in select * from jsonb_array_elements(v_employee->'postings')
    loop
      insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo, employee_id)
      values (
        v_journal_entry_id,
        v_org_id,
        v_posting->>'account_code',
        v_posting->>'direction',
        (v_posting->>'amount_kobo')::bigint,
        (v_employee->>'employee_id')::uuid
      );
    end loop;
  end loop;

  for v_posting in select * from jsonb_array_elements(coalesce(payload->'org_postings', '[]'::jsonb))
  loop
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo, employee_id)
    values (
      v_journal_entry_id,
      v_org_id,
      v_posting->>'account_code',
      v_posting->>'direction',
      (v_posting->>'amount_kobo')::bigint,
      null
    );
  end loop;

  for v_repayment in select * from jsonb_array_elements(coalesce(payload->'loan_repayments', '[]'::jsonb))
  loop
    update public.loans
    set
      outstanding_kobo = outstanding_kobo - (v_repayment->>'amount_kobo')::bigint,
      status = case
        when outstanding_kobo - (v_repayment->>'amount_kobo')::bigint <= 0 then 'completed'
        else status
      end
    where id = (v_repayment->>'loan_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning outstanding_kobo into v_new_outstanding;

    if v_new_outstanding is null then
      raise exception 'Loan % not found, not approved, or you do not have permission to repay it', v_repayment->>'loan_id';
    end if;

    if v_new_outstanding < 0 then
      raise exception 'Repayment of % exceeds outstanding balance for loan %', v_repayment->>'amount_kobo', v_repayment->>'loan_id';
    end if;

    insert into public.loan_repayments (loan_id, pay_run_id, org_id, employee_id, amount_kobo)
    values (
      (v_repayment->>'loan_id')::uuid,
      v_pay_run.id,
      v_org_id,
      (v_repayment->>'employee_id')::uuid,
      (v_repayment->>'amount_kobo')::bigint
    );
  end loop;

  for v_expense in select * from jsonb_array_elements(coalesce(payload->'expense_reimbursements', '[]'::jsonb))
  loop
    update public.expenses
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_expense->>'expense_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_expense_id;

    if v_paid_expense_id is null then
      raise exception 'Expense claim % not found, not approved, or you do not have permission to pay it', v_expense->>'expense_id';
    end if;
  end loop;

  for v_leave in select * from jsonb_array_elements(coalesce(payload->'leave_deductions', '[]'::jsonb))
  loop
    update public.leave_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_leave->>'leave_request_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
      and leave_type = 'unpaid'
    returning id into v_paid_leave_id;

    if v_paid_leave_id is null then
      raise exception 'Leave request % not found, not approved unpaid leave, or you do not have permission to deduct it', v_leave->>'leave_request_id';
    end if;
  end loop;

  return v_pay_run;
end;
$$;

revoke all on function public.create_pay_run(jsonb) from public;
grant execute on function public.create_pay_run(jsonb) to authenticated;
