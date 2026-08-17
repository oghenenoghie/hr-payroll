-- Trade Union Dues (People Operations pillar). Answers a direct gap: no
-- deduction type existed anywhere in the schema for a trade union
-- subscription — grepping for "union"/"dues" across every migration and
-- the payslip columns turned up nothing but the SQL UNION keyword. This
-- adds it as its own first-class deduction, not a repurposed benefit or
-- loan row, following the same "plan catalog + opt-in enrollment" shape
-- as benefit_plans/employee_benefit_enrollments
-- (20260723100000_benefits_administration.sql) since that's the closest
-- existing fit: HR/payroll registers each recognized union once (name +
-- the fixed per-period due it collects), then opts individual employees
-- in. Deliberately simpler than benefits, though — a union due is a
-- flat amount withheld from the employee's own pay and remitted onward,
-- never an employer cost, so there's no employer_cost_kobo column and no
-- separate expense account: it's modelled like PAYE/pension/NHF (a
-- withholding that reallocates part of the credit side of the entry),
-- not like a benefit premium (a genuinely new debit).
--
-- Admin/hr_manager/payroll_manager/accountant-managed only, no employee
-- self-enroll — same reasoning as benefits (an employee could pick an
-- ineligible or wrong-category plan without HR sign-off), and accountant
-- is included alongside payroll_manager per 20260730000000_new_org_
-- roles.sql's "full Payroll Manager parity" rule, since this is a
-- payroll deduction, not purely an HR benefit. Employees can view their
-- own enrollment and the org's plan catalog read-only via /me.
create table public.union_dues_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index union_dues_plans_org_id_idx on public.union_dues_plans (org_id);

alter table public.union_dues_plans enable row level security;

create policy "org members can view union dues plans"
on public.union_dues_plans for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and payroll staff can create union dues plans"
on public.union_dues_plans for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

create policy "admins and payroll staff can update union dues plans"
on public.union_dues_plans for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

create table public.employee_union_due_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  union_dues_plan_id uuid not null references public.union_dues_plans (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  enrolled_by uuid not null,
  enrolled_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint employee_union_due_enrollments_cancelled_matches_status check (
    (status = 'cancelled' and cancelled_at is not null)
    or (status = 'active' and cancelled_at is null)
  )
);

create index employee_union_due_enrollments_org_id_idx on public.employee_union_due_enrollments (org_id);
create index employee_union_due_enrollments_employee_id_idx on public.employee_union_due_enrollments (employee_id);

-- One active enrollment per employee/plan at a time — same reasoning as
-- benefits' equivalent index: blocks two simultaneously active rows from
-- double-deducting the same union's due, while still allowing
-- re-enrollment (a new row) after a cancellation.
create unique index employee_union_due_enrollments_one_active_idx
on public.employee_union_due_enrollments (employee_id, union_dues_plan_id)
where status = 'active';

alter table public.employee_union_due_enrollments enable row level security;

create policy "employees can view their own union dues enrollments"
on public.employee_union_due_enrollments for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = employee_union_due_enrollments.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and payroll staff can view all union dues enrollments"
on public.employee_union_due_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

create policy "admins and payroll staff can enroll employees in union dues"
on public.employee_union_due_enrollments for insert
to authenticated
with check (
  status = 'active'
  and cancelled_at is null
  and enrolled_by = auth.uid()
  and core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant'])
);

create policy "admins and payroll staff can cancel union dues enrollments"
on public.employee_union_due_enrollments for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

-- Stored explicitly on the payslip, same reasoning as every other
-- deduction column here: a residual subtraction off employee_deductions_
-- kobo can't tell union dues apart from a loan repayment or a benefit
-- contribution, all three being post-tax deductions layered the same way.
alter table public.payslips
  add column union_dues_deduction_kobo bigint not null default 0;

-- New liability account every org needs before a run can post a union
-- dues withholding — seeded for existing orgs the same way
-- 20260730020000_chart_of_accounts.sql seeded benefits_payable etc, and
-- added to create_organization below so a brand-new org's chart isn't
-- missing it either. Modelled as a payable, not an expense: the whole
-- gross wage is already inside payroll_expense, this account only tracks
-- what's owed to the union instead of to the employee directly (same
-- shape as paye_payable/pension_payable/nhf_payable).
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, 'union_dues_payable', 'Union dues payable (due to the recognized trade union)', 'liability', true
from public.organizations o
on conflict (org_id, code) do nothing;

create or replace function public.create_organization(
  p_name text,
  p_rc_number text default null,
  p_company_tin text default null,
  p_default_pay_frequency text default 'monthly',
  p_default_pfa text default null,
  p_states_of_operation text[] default '{}'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, rc_number, company_tin, default_pay_frequency, default_pfa, states_of_operation)
  values (p_name, p_rc_number, p_company_tin, p_default_pay_frequency, p_default_pfa, p_states_of_operation)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  insert into public.chart_of_accounts (org_id, code, name, type, is_system)
  values
    (v_org.id, 'payroll_expense', 'Payroll expense', 'expense', true),
    (v_org.id, 'expense_reimbursement_expense', 'Expense reimbursement expense', 'expense', true),
    (v_org.id, 'overtime_pay_expense', 'Overtime pay expense', 'expense', true),
    (v_org.id, 'thirteenth_month_expense', '13th month expense', 'expense', true),
    (v_org.id, 'bonus_expense', 'Bonus expense', 'expense', true),
    (v_org.id, 'arrears_expense', 'Arrears expense', 'expense', true),
    (v_org.id, 'employer_pension_expense', 'Employer pension expense', 'expense', true),
    (v_org.id, 'benefits_expense', 'Benefits expense', 'expense', true),
    (v_org.id, 'leave_payout_expense', 'Leave payout expense (final settlement)', 'expense', true),
    (v_org.id, 'gratuity_expense', 'Gratuity expense (final settlement)', 'expense', true),
    (v_org.id, 'nsitf_expense', 'NSITF expense', 'expense', true),
    (v_org.id, 'vendor_expense', 'Vendor expense', 'expense', true),
    (v_org.id, 'net_pay_payable', 'Net pay payable', 'liability', true),
    (v_org.id, 'paye_payable', 'PAYE payable (due FIRS/state IRS, before the 10th)', 'liability', true),
    (v_org.id, 'pension_payable', 'Pension payable (due PFA, before the 7th)', 'liability', true),
    (v_org.id, 'nhf_payable', 'NHF payable (due FMBN, before the 10th)', 'liability', true),
    (v_org.id, 'benefits_payable', 'Benefits payable', 'liability', true),
    (v_org.id, 'union_dues_payable', 'Union dues payable (due to the recognized trade union)', 'liability', true),
    (v_org.id, 'nsitf_payable', 'NSITF payable (due NSITF, before the 16th)', 'liability', true),
    (v_org.id, 'accounts_payable', 'Accounts payable', 'liability', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;

-- create_pay_run(): full redeclare per 20260731030000_payroll_variance_
-- detection.sql (the last migration to touch it). Only change: accepts
-- and persists union_dues_deduction_kobo per payslip, same coalesce-to-
-- zero-if-absent treatment as every other optional deduction column.
create or replace function public.create_pay_run(payload jsonb)
returns pay_runs
language plpgsql
security definer
set search_path = ''
as $function$
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
  if not core.has_org_role(v_org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to create a pay run for this organization';
  end if;

  insert into public.pay_runs (
    org_id, period_start, period_end, frequency, rule_version_id,
    employee_count, gross_kobo, net_kobo, created_by, status
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
    auth.uid(),
    coalesce(payload->>'status', 'posted')
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
      overtime_pay_kobo, new_hire_proration_deduction_kobo, leave_encashment_kobo,
      salary_change_adjustment_kobo, arrears_note, union_dues_deduction_kobo
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
      coalesce((v_employee->>'leave_encashment_kobo')::bigint, 0),
      coalesce((v_employee->>'salary_change_adjustment_kobo')::bigint, 0),
      v_employee->>'arrears_note',
      coalesce((v_employee->>'union_dues_deduction_kobo')::bigint, 0)
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

  perform core.detect_pay_run_variance(v_pay_run.id);

  return v_pay_run;
end;
$function$;

revoke all on function public.create_pay_run(jsonb) from public, anon, authenticated;
grant execute on function public.create_pay_run(jsonb) to authenticated;

-- posted_payslips: full redeclare, body unchanged from 20260813010000 —
-- CREATE OR REPLACE VIEW resolves `p.*` again at replace time, which is
-- the only way the view's own column list picks up union_dues_deduction_
-- kobo (a view's column set is fixed at creation/replace time, not
-- re-resolved on every query).
create or replace view public.posted_payslips
with (security_invoker = true)
as
select p.*
from public.payslips p
join public.pay_runs r on r.id = p.pay_run_id
where r.status = 'posted';
