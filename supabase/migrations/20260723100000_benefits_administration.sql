-- Benefits Administration (People Operations pillar). An HR-managed plan
-- catalog (health, life, pension top-up, wellness, other) each carrying an
-- employer cost and an optional employee cost per pay period. Enrolling an
-- employee makes both amounts apply automatically in every pay run from
-- then on — the same "reuse the atomic pay-run writer" pattern as loans,
-- expenses and leave, except there's no claim to approve and no balance to
-- pay down: enrollment itself is the authorization, and it recurs every
-- period until cancelled.
--
-- Deliberately admin/hr_manager-managed only, no employee self-enroll —
-- matches product-and-ia.md's role table ("HR Manager | ... · Benefits").
-- Employees can view their own enrollments and the org's plan catalog
-- read-only, so /me can show what they're enrolled in and what it costs
-- the company, but never enroll or cancel themselves.
create table public.benefit_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  category text not null check (category in ('health', 'life', 'pension_topup', 'wellness', 'other')),
  employer_cost_kobo bigint not null check (employer_cost_kobo >= 0),
  employee_cost_kobo bigint not null default 0 check (employee_cost_kobo >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index benefit_plans_org_id_idx on public.benefit_plans (org_id);

alter table public.benefit_plans enable row level security;

create policy "org members can view benefit plans"
on public.benefit_plans for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and HR managers can create benefit plans"
on public.benefit_plans for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update benefit plans"
on public.benefit_plans for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.employee_benefit_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  benefit_plan_id uuid not null references public.benefit_plans (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  enrolled_by uuid not null,
  enrolled_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint employee_benefit_enrollments_cancelled_matches_status check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status = 'active' and cancelled_at is null)
  )
);

create index employee_benefit_enrollments_org_id_idx on public.employee_benefit_enrollments (org_id);
create index employee_benefit_enrollments_employee_id_idx on public.employee_benefit_enrollments (employee_id);

-- One active enrollment per employee/plan at a time. Re-enrolling after a
-- cancellation is fine (a new row) — this only blocks two simultaneously
-- active rows from double-charging the same plan.
create unique index employee_benefit_enrollments_one_active_idx
on public.employee_benefit_enrollments (employee_id, benefit_plan_id)
where status = 'active';

alter table public.employee_benefit_enrollments enable row level security;

create policy "employees can view their own benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = employee_benefit_enrollments.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and HR managers can view all benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can enroll employees"
on public.employee_benefit_enrollments for insert
to authenticated
with check (
  status = 'active'
  and cancelled_at is null
  and enrolled_by = auth.uid()
  and core.has_org_role(org_id, array['admin', 'hr_manager'])
);

create policy "admins and HR managers can cancel benefit enrollments"
on public.employee_benefit_enrollments for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Store the benefits split explicitly on the payslip — same reasoning as
-- the reimbursement/leave columns: the "· how?" derivation can't show what
-- it can't see, and a residual subtraction off employee_deductions_kobo
-- would conflate this with loan repayment (both are post-tax components).
alter table public.payslips
  add column benefit_employer_cost_kobo bigint not null default 0,
  add column benefit_employee_deduction_kobo bigint not null default 0;

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
      taxable_reimbursement_kobo, non_taxable_reimbursement_kobo, unpaid_leave_deduction_kobo,
      benefit_employer_cost_kobo, benefit_employee_deduction_kobo
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
      coalesce((v_employee->>'benefit_employee_deduction_kobo')::bigint, 0)
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
