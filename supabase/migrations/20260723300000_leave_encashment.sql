-- Leave encashment — feature-backlog.md §1's "leave encashment and its tax
-- treatment," previously unbuilt: an active employee cashing out some of
-- their unused annual leave for money, distinct from Final Settlement's
-- leave payout (which only ever fires at termination). Taxable, like any
-- earned pay, but never pensionable or in the NHF base — same tagging
-- reasoning as gratuity/leave-payout in deriveLumpSumPayslip, since a
-- leave payout isn't Basic/Housing/Transport. Paid via the next regular
-- pay run, using the same daily-rate convention (annual contractual ÷
-- 365) as unpaid leave, attendance-absence and new-hire proration.
--
-- Approval must atomically check the request against the employee's
-- *current* annual_leave_balance_days and decrement it in the same
-- transaction — otherwise two pending requests could jointly encash more
-- days than the employee actually has. review_leave_encashment_request()
-- mirrors review_leave_request()'s exact security-definer pattern for
-- that reason. Deliberately no generic admin/payroll_manager UPDATE RLS
-- policy on this table (unlike leave_requests, which kept one alongside
-- its RPC): every status transition here must go through the balance-
-- checked function, with no direct-update escape hatch to design around.
create table public.leave_encashment_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  days_requested integer not null check (days_requested > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  requested_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  paid_pay_run_id uuid references public.pay_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index leave_encashment_requests_org_id_idx on public.leave_encashment_requests (org_id);
create index leave_encashment_requests_employee_id_idx on public.leave_encashment_requests (employee_id);

alter table public.leave_encashment_requests enable row level security;

create policy "employees can view their own leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = leave_encashment_requests.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can view all leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "employees can submit a leave encashment request for themselves"
on public.leave_encashment_requests for insert
to authenticated
with check (
  status = 'pending'
  and requested_by = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = leave_encashment_requests.employee_id and e.user_id = auth.uid()
  )
);

create or replace function public.review_leave_encashment_request(p_request_id uuid, p_approve boolean)
returns public.leave_encashment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_encashment_requests;
begin
  select * into v_request from public.leave_encashment_requests where id = p_request_id and status = 'pending';

  if v_request.id is null then
    raise exception 'Leave encashment request % not found or not pending', p_request_id;
  end if;

  if not core.has_org_role(v_request.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to review this leave encashment request';
  end if;

  if p_approve then
    update public.employees
    set annual_leave_balance_days = annual_leave_balance_days - v_request.days_requested
    where id = v_request.employee_id and annual_leave_balance_days >= v_request.days_requested;

    if not found then
      raise exception 'Employee has insufficient annual leave balance for this request';
    end if;

    update public.leave_encashment_requests
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id
    returning * into v_request;
  else
    update public.leave_encashment_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id
    returning * into v_request;
  end if;

  return v_request;
end;
$$;

revoke all on function public.review_leave_encashment_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_leave_encashment_request(uuid, boolean) to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
  'loan_request_submitted', 'loan_approved', 'loan_rejected',
  'expense_submitted', 'expense_approved', 'expense_rejected',
  'benefit_enrolled',
  'pay_run_created',
  'overtime_request_submitted', 'overtime_approved', 'overtime_rejected',
  'leave_encashment_submitted', 'leave_encashment_approved', 'leave_encashment_rejected'
));

-- Same reasoning as the reimbursement/leave/attendance/benefits/overtime
-- columns: store the encashment payout explicitly so the "· how?"
-- derivation can show it as its own line rather than folding it silently
-- into gross.
alter table public.payslips
  add column leave_encashment_kobo bigint not null default 0;

-- Extends create_pay_run (same atomic-writer pattern as overtime_payments)
-- to accept an optional payload.leave_encashments array:
-- [{leave_encashment_id, employee_id}]. Each one is atomically flipped to
-- 'paid' and linked to this pay run — only from 'approved', so a request
-- can never be paid twice or paid before it's approved (the balance
-- decrement already happened at approval time, via the RPC above).
create or replace function public.create_pay_run(payload jsonb)
returns public.pay_runs
language plpgsql
security definer
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
  v_attendance jsonb;
  v_overtime jsonb;
  v_encashment jsonb;
  v_new_outstanding bigint;
  v_paid_expense_id uuid;
  v_paid_leave_id uuid;
  v_paid_attendance_id uuid;
  v_paid_overtime_id uuid;
  v_paid_encashment_id uuid;
begin
  if not core.has_org_role(v_org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to create a pay run for this organization';
  end if;

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
      taxable_reimbursement_kobo, non_taxable_reimbursement_kobo, unpaid_leave_deduction_kobo,
      benefit_employer_cost_kobo, benefit_employee_deduction_kobo, attendance_absence_deduction_kobo,
      overtime_pay_kobo, new_hire_proration_deduction_kobo, leave_encashment_kobo
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
      coalesce((v_employee->>'non_taxable_reimbursement_kobo')::bigint, 0),
      coalesce((v_employee->>'unpaid_leave_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'benefit_employer_cost_kobo')::bigint, 0),
      coalesce((v_employee->>'benefit_employee_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'attendance_absence_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'overtime_pay_kobo')::bigint, 0),
      coalesce((v_employee->>'new_hire_proration_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'leave_encashment_kobo')::bigint, 0)
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

  for v_attendance in select * from jsonb_array_elements(coalesce(payload->'attendance_deductions', '[]'::jsonb))
  loop
    update public.attendance_records
    set paid_pay_run_id = v_pay_run.id
    where id = (v_attendance->>'attendance_record_id')::uuid
      and org_id = v_org_id
      and status = 'absent'
      and paid_pay_run_id is null
    returning id into v_paid_attendance_id;

    if v_paid_attendance_id is null then
      raise exception 'Attendance record % not found, not an unprocessed absence, or you do not have permission to deduct it', v_attendance->>'attendance_record_id';
    end if;
  end loop;

  for v_overtime in select * from jsonb_array_elements(coalesce(payload->'overtime_payments', '[]'::jsonb))
  loop
    update public.overtime_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_overtime->>'overtime_request_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_overtime_id;

    if v_paid_overtime_id is null then
      raise exception 'Overtime request % not found, not approved, or you do not have permission to pay it', v_overtime->>'overtime_request_id';
    end if;
  end loop;

  for v_encashment in select * from jsonb_array_elements(coalesce(payload->'leave_encashments', '[]'::jsonb))
  loop
    update public.leave_encashment_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_encashment->>'leave_encashment_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_encashment_id;

    if v_paid_encashment_id is null then
      raise exception 'Leave encashment request % not found, not approved, or you do not have permission to pay it', v_encashment->>'leave_encashment_id';
    end if;
  end loop;

  return v_pay_run;
end;
$$;

revoke all on function public.create_pay_run(jsonb) from public, anon, authenticated;
grant execute on function public.create_pay_run(jsonb) to authenticated;
