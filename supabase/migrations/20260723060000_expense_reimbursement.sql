-- Expense Reimbursement (People Operations pillar, second slice). An
-- employee submits a claim from self-service; admin/payroll_manager decide
-- whether it's taxable when they approve it (a tax-treatment call belongs
-- to the employer, never something the employee self-selects) or reject
-- it. An approved claim is reimbursed through the next pay run: taxable
-- claims add to chargeable income and are re-taxed through the normal
-- progressive bands; non-taxable claims are pure pass-through cash. Neither
-- ever touches pension or NHF base — reimbursements aren't pensionable pay.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  description text not null,
  taxable boolean,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  requested_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  paid_pay_run_id uuid references public.pay_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A decided claim always has a tax treatment; an undecided (pending) one
  -- never does. Keeps "approve without deciding taxability" unrepresentable.
  constraint expenses_taxable_matches_status check (
    (status in ('approved', 'paid') and taxable is not null)
    or (status in ('pending', 'rejected') and taxable is null)
  )
);

create index expenses_org_id_idx on public.expenses (org_id);
create index expenses_employee_id_idx on public.expenses (employee_id);

alter table public.expenses enable row level security;

create policy "employees can view their own expense claims"
on public.expenses for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = expenses.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can view all expense claims"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "employees can submit an expense claim for themselves"
on public.expenses for insert
to authenticated
with check (
  status = 'pending'
  and taxable is null
  and requested_by = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = expenses.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll managers can update expense claims"
on public.expenses for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Extends create_pay_run (same atomic-writer pattern as the NSITF and loan
-- extensions) to accept an optional payload.expense_reimbursements array:
-- [{expense_id, employee_id}]. Each one is atomically flipped to 'paid' and
-- linked to this pay run — only from 'approved', so a claim can never be
-- reimbursed twice or reimbursed before it's approved.
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
  v_new_outstanding bigint;
  v_paid_expense_id uuid;
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

  return v_pay_run;
end;
$$;

revoke all on function public.create_pay_run(jsonb) from public;
grant execute on function public.create_pay_run(jsonb) to authenticated;
