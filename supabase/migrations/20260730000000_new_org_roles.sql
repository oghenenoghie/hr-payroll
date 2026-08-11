-- Three new org roles, alongside the existing admin/payroll_manager/
-- hr_manager/employee set: 'accountant' (full Payroll Manager parity —
-- everywhere payroll_manager appears in a role check, accountant is added
-- alongside it), 'department_manager' (its own migration,
-- 20260730020000, since it needs a new departments.manager_id column and
-- department-scoped policies rather than a simple array widening), and
-- 'auditor' (its own migration, 20260730010000 — strictly read-only,
-- added only to SELECT policies, never to INSERT/UPDATE/DELETE).
--
-- "Super Admin" (the display name for the existing 'admin' role) is a
-- label-only change and needs no migration — see AppShell.tsx and
-- security/page.tsx.
alter table public.org_memberships drop constraint org_memberships_role_check;
alter table public.org_memberships add constraint org_memberships_role_check
  check (role in ('admin', 'payroll_manager', 'hr_manager', 'accountant', 'department_manager', 'auditor', 'employee'));

-- employees_masked: latest definition was 20260724000000_branches.sql's.
-- Full redeclare (the only way to change a view's column expressions) —
-- accountant now sees real salary figures, same as admin/payroll_manager,
-- since it has full payroll-processing parity with Payroll Manager.
create or replace view public.employees_masked
with (security_invoker = true)
as
select
  e.id,
  e.org_id,
  e.full_name,
  e.email,
  e.state_of_residence,
  e.hire_date,
  e.status,
  e.tin,
  e.tin_valid_from,
  e.tin_valid_to,
  e.pfa,
  e.manager_id,
  e.user_id,
  e.linked_at,
  e.annual_leave_balance_days,
  e.created_at,
  e.salary_masked,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'accountant'])
    then null else e.bank_account_name end as bank_account_name,
  e.department_id,
  d.name as department_name,
  e.date_of_birth,
  e.nationality,
  e.job_grade_id,
  jg.name as job_grade_name,
  e.probation_end_date,
  e.confirmed,
  e.employment_type,
  e.contract_end_date,
  e.branch_id,
  b.name as branch_name
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id
left join public.branches b on b.id = e.branch_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;

-- employees: accountant needs the same directory visibility payroll_manager
-- already has, to process runs and reconcile reports against headcount.
drop policy if exists "org staff can view employees" on public.employees;
create policy "org staff can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'hr_manager', 'accountant']));

-- pay_runs / payslips
drop policy if exists "admins and payroll managers can view pay runs" on public.pay_runs;
create policy "admins and payroll managers can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can create pay runs" on public.pay_runs;
create policy "admins and payroll managers can create pay runs"
on public.pay_runs for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can view payslips" on public.payslips;
create policy "admins and payroll managers can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can create payslips" on public.payslips;
create policy "admins and payroll managers can create payslips"
on public.payslips for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- journal_entries / ledger_postings
drop policy if exists "admins and payroll managers can view journal entries" on public.journal_entries;
create policy "admins and payroll managers can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can create journal entries" on public.journal_entries;
create policy "admins and payroll managers can create journal entries"
on public.journal_entries for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can view ledger postings" on public.ledger_postings;
create policy "admins and payroll managers can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can create ledger postings" on public.ledger_postings;
create policy "admins and payroll managers can create ledger postings"
on public.ledger_postings for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- pay_run_reversals (view only — reverse_pay_run() itself stays admin-only,
-- deliberately a higher bar than payroll processing; see 20260723220000's
-- own comment on that choice).
drop policy if exists "admins and payroll managers can view pay run reversals" on public.pay_run_reversals;
create policy "admins and payroll managers can view pay run reversals"
on public.pay_run_reversals for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- loans / loan_repayments
drop policy if exists "admins and payroll managers can view all loans" on public.loans;
create policy "admins and payroll managers can view all loans"
on public.loans for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can update loans" on public.loans;
create policy "admins and payroll managers can update loans"
on public.loans for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can view all loan repayments" on public.loan_repayments;
create policy "admins and payroll managers can view all loan repayments"
on public.loan_repayments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can create loan repayments" on public.loan_repayments;
create policy "admins and payroll managers can create loan repayments"
on public.loan_repayments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- expenses
drop policy if exists "admins and payroll managers can view all expense claims" on public.expenses;
create policy "admins and payroll managers can view all expense claims"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can update expense claims" on public.expenses;
create policy "admins and payroll managers can update expense claims"
on public.expenses for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- overtime_requests
drop policy if exists "admins and payroll managers can view all overtime requests" on public.overtime_requests;
create policy "admins and payroll managers can view all overtime requests"
on public.overtime_requests for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can update overtime requests" on public.overtime_requests;
create policy "admins and payroll managers can update overtime requests"
on public.overtime_requests for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- leave_encashment_requests (view only — approval goes through
-- review_leave_encashment_request(), redeclared below)
drop policy if exists "admins and payroll managers can view all leave encashment requests" on public.leave_encashment_requests;
create policy "admins and payroll managers can view all leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- final_settlements
drop policy if exists "admins and payroll managers can view final settlements" on public.final_settlements;
create policy "admins and payroll managers can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can record final settlements" on public.final_settlements;
create policy "admins and payroll managers can record final settlements"
on public.final_settlements for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- employee_compensation_history
drop policy if exists "admin and payroll manager can view compensation history" on public.employee_compensation_history;
create policy "admin and payroll manager can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- employee_status_history / onboarding / offboarding / documents — these
-- already include hr_manager alongside payroll_manager.
drop policy if exists "org staff can view employee status history" on public.employee_status_history;
create policy "org staff can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'hr_manager', 'accountant']));

drop policy if exists "admins, HR and payroll managers can view onboarding checklists" on public.employee_onboarding_checklist;
create policy "admins, HR and payroll managers can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

drop policy if exists "admins, HR and payroll managers can view offboarding checklists" on public.employee_offboarding_checklist;
create policy "admins, HR and payroll managers can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

drop policy if exists "admins, HR and payroll managers can view all employee documents" on public.employee_documents;
create policy "admins, HR and payroll managers can view all employee documents"
on public.employee_documents for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager', 'accountant']));

drop policy if exists "admins, HR, payroll managers and the owning employee can view employee-documents" on storage.objects;
create policy "admins, HR, payroll managers and the owning employee can view employee-documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'employee-documents'
  and (
    core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager', 'payroll_manager', 'accountant'])
    or exists (
      select 1 from public.employees e
      where e.id = (storage.foldername(name))[2]::uuid
        and e.user_id = auth.uid()
    )
  )
);

-- create_pay_run(): full redeclare, current definition per
-- 20260727030000_arrears_pay_run.sql (the last migration to touch it) —
-- only change is 'accountant' added to the top authorization check.
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
      salary_change_adjustment_kobo, arrears_note
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
      v_employee->>'arrears_note'
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
$function$;

revoke all on function public.create_pay_run(jsonb) from public, anon, authenticated;
grant execute on function public.create_pay_run(jsonb) to authenticated;

-- approve_pay_run() / discard_pay_run_draft(): full redeclare per
-- 20260727020000_pay_run_draft_state.sql, 'accountant' added.
create or replace function public.approve_pay_run(p_pay_run_id uuid)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to approve a pay run for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be approved';
  end if;

  update public.pay_runs
  set status = 'posted', approved_by = auth.uid(), approved_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.approve_pay_run(uuid) from public;
grant execute on function public.approve_pay_run(uuid) to authenticated;

create or replace function public.discard_pay_run_draft(p_pay_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to discard a pay run draft for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be discarded';
  end if;

  update public.loans l
  set
    outstanding_kobo = l.outstanding_kobo + r.amount_kobo,
    status = case when l.status = 'completed' then 'approved' else l.status end
  from public.loan_repayments r
  where r.pay_run_id = p_pay_run_id and r.loan_id = l.id;

  update public.expenses
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.leave_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.attendance_records
  set paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id;

  update public.overtime_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.leave_encashment_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  delete from public.journal_entries where pay_run_id = p_pay_run_id;
  delete from public.pay_runs where id = p_pay_run_id;
end;
$$;

revoke all on function public.discard_pay_run_draft(uuid) from public;
grant execute on function public.discard_pay_run_draft(uuid) to authenticated;

-- review_leave_encashment_request(): full redeclare per
-- 20260723300000_leave_encashment.sql, 'accountant' added.
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

  if not core.has_org_role(v_request.org_id, array['admin', 'payroll_manager', 'accountant']) then
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

-- check_pending_approvals(): the loans/expenses/overtime_requests/
-- leave_encashment_requests recipient lookup notifies whoever can approve
-- them — now includes accountant. The separate leave_requests loop stays
-- admin/hr_manager only (unchanged; department managers are notified
-- through a narrower, per-department mechanism, not this org-wide blast).
create or replace function core.check_pending_approvals()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_threshold_days constant int := 3;
  v_request record;
  v_recipients uuid[];
begin
  for v_request in
    select 'loans' as request_table, l.id, l.org_id, e.full_name, '/loans' as link
    from public.loans l
    join public.employees e on e.id = l.employee_id
    where l.status = 'pending'
      and l.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'loans' and n.request_id = l.id
      )
    union all
    select 'expenses', x.id, x.org_id, e.full_name, '/expenses'
    from public.expenses x
    join public.employees e on e.id = x.employee_id
    where x.status = 'pending'
      and x.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'expenses' and n.request_id = x.id
      )
    union all
    select 'overtime_requests', o.id, o.org_id, e.full_name, '/overtime'
    from public.overtime_requests o
    join public.employees e on e.id = o.employee_id
    where o.status = 'pending'
      and o.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'overtime_requests' and n.request_id = o.id
      )
    union all
    select 'leave_encashment_requests', c.id, c.org_id, e.full_name, '/leave'
    from public.leave_encashment_requests c
    join public.employees e on e.id = c.employee_id
    where c.status = 'pending'
      and c.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'leave_encashment_requests' and n.request_id = c.id
      )
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_request.org_id and role in ('admin', 'payroll_manager', 'accountant');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select v_request.org_id, uid, 'approval_pending_reminder',
        v_request.full_name || '''s request has been pending ' || v_threshold_days || '+ days — take a look.',
        v_request.link
      from unnest(v_recipients) as uid;
    end if;

    insert into core.approval_aging_notified (request_table, request_id) values (v_request.request_table, v_request.id);
  end loop;

  for v_request in
    select r.id, r.org_id, e.full_name
    from public.leave_requests r
    join public.employees e on e.id = r.employee_id
    where r.status = 'pending'
      and r.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'leave_requests' and n.request_id = r.id
      )
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_request.org_id and role in ('admin', 'hr_manager');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select v_request.org_id, uid, 'approval_pending_reminder',
        v_request.full_name || '''s leave request has been pending ' || v_threshold_days || '+ days — take a look.',
        '/leave'
      from unnest(v_recipients) as uid;
    end if;

    insert into core.approval_aging_notified (request_table, request_id) values ('leave_requests', v_request.id);
  end loop;
end;
$$;

revoke execute on function core.check_pending_approvals() from public, anon, authenticated;
