-- Loans & Advances (People Operations pillar, first slice). An employee
-- requests a loan from self-service; admin/payroll_manager approve or
-- reject; an approved loan is then deducted from net pay automatically in
-- every pay run — min(monthly_repayment_kobo, outstanding_kobo) each time —
-- until outstanding_kobo reaches zero and the loan completes itself.
--
-- Deliberately out of scope: recording the loan *disbursement* as a ledger
-- entry (the payout to the employee is assumed to happen outside this
-- system, e.g. a bank transfer HR arranges). Only the repayment side, which
-- actually touches payroll, is modelled in the ledger here.
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  principal_kobo bigint not null check (principal_kobo > 0),
  monthly_repayment_kobo bigint not null check (monthly_repayment_kobo > 0),
  outstanding_kobo bigint not null check (outstanding_kobo >= 0 and outstanding_kobo <= principal_kobo),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  reason text,
  requested_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index loans_org_id_idx on public.loans (org_id);
create index loans_employee_id_idx on public.loans (employee_id);

alter table public.loans enable row level security;

create policy "employees can view their own loans"
on public.loans for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = loans.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can view all loans"
on public.loans for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Employees can only ever open a request for themselves, starting pending —
-- never pre-approve their own loan or request one for a colleague.
create policy "employees can request a loan for themselves"
on public.loans for insert
to authenticated
with check (
  status = 'pending'
  and outstanding_kobo = principal_kobo
  and requested_by = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = loans.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can update loans"
on public.loans for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);

create index loan_repayments_loan_id_idx on public.loan_repayments (loan_id);
create index loan_repayments_pay_run_id_idx on public.loan_repayments (pay_run_id);

alter table public.loan_repayments enable row level security;

create policy "employees can view their own loan repayments"
on public.loan_repayments for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = loan_repayments.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can view all loan repayments"
on public.loan_repayments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can create loan repayments"
on public.loan_repayments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Extends create_pay_run (same atomic-writer pattern as the NSITF
-- extension) to accept an optional payload.loan_repayments array:
-- [{loan_id, employee_id, amount_kobo}]. Each repayment atomically
-- decrements loans.outstanding_kobo in the same transaction as the rest of
-- the run, and flips the loan to 'completed' once it hits zero — so a
-- repayment can never be double-applied or outlive its loan's balance.
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
  v_new_outstanding bigint;
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
      cumulative_chargeable_income_before_kobo, cumulative_paye_paid_before_kobo
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
      (v_employee->>'cumulative_paye_paid_before_kobo')::bigint
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

  return v_pay_run;
end;
$$;

revoke all on function public.create_pay_run(jsonb) from public;
grant execute on function public.create_pay_run(jsonb) to authenticated;
