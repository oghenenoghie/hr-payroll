-- Splits Compensation & Benefits Manager and Finance Manager/CFO out as
-- real org_membership roles — the Full Feature Map gap-analysis's next
-- priority item after Auditor/Department Manager/Performance
-- Management/Recruitment. Unlike those, this isn't new capability: job
-- grades, salary fields, compensation history, benefits, chart of
-- accounts, the general ledger, budgets and financial statements all
-- already exist under admin/payroll_manager/hr_manager. This migration
-- is RBAC plumbing on data that's already there — the same additive-
-- policy-per-role convention as every other role this session, applied
-- to two new role values instead of new tables.
--
-- Compensation & Benefits Manager owns individual employee comp: job
-- grades, salary fields (view unmasked + edit), compensation history,
-- benefit enrollment. Finance Manager/CFO owns the aggregate financial
-- picture: chart of accounts, the ledger, budgets (with real approval
-- power — insert/update/delete, not just read), bank reconciliation,
-- fixed assets, and payroll's financial totals — deliberately NOT
-- individual salary fields, since that's Compensation & Benefits
-- Manager's territory, not Finance's. Neither role touches AP/AR
-- day-to-day operations (vendors, bills, customers, invoices) — that
-- stays Payroll Manager/Accountant's, unchanged.
insert into public.roles (key, label, mfa_required, sort_order) values
  ('compensation_benefits_manager', 'Compensation & Benefits Manager', false, 7),
  ('finance_manager', 'Finance Manager / CFO', false, 8);

insert into public.permissions (key, module, label) values
  ('budget.approve', 'finance', 'Approve budgets and financial forecasts');

insert into public.role_permissions (role_key, permission_key) values
  ('compensation_benefits_manager', 'employee.record.view'),
  ('compensation_benefits_manager', 'salary.view.unmasked'),
  ('compensation_benefits_manager', 'payroll.structure.edit'),
  ('compensation_benefits_manager', 'benefits.manage'),
  ('finance_manager', 'reports.export'),
  ('finance_manager', 'budget.approve'),
  ('finance_manager', 'audit.read');

-- Job grades: job_grades' own SELECT policy is already org-wide
-- (core.is_org_member), so only write access needs granting here.
create policy "compensation managers can create job grades"
on public.job_grades for insert
to authenticated
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can update job grades"
on public.job_grades for update
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']))
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can delete job grades"
on public.job_grades for delete
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']));

-- Employees: Compensation & Benefits Manager gets full read/write, same
-- shape as admin/hr_manager's existing policies — the editEmployee
-- Server Action already restricts which fields actually get written
-- based on role (see canEditSalary in apps/wagebook/src/app/(app)/
-- employees/[id]/edit/actions.ts), the same trust-the-app-layer model
-- every other blanket-table RLS grant in this codebase already uses
-- (e.g. admin/payroll_manager on overtime_requests).
create policy "compensation managers can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can update employees"
on public.employees for update
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']))
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

-- Finance Manager needs employee visibility for payroll-cost reporting
-- (which department/employee a payslip belongs to), but never gets
-- unmasked salary — see the employees_masked view below, deliberately
-- unchanged for this role.
create policy "finance managers can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

-- Pre-existing bug, discovered while touching this table for the two
-- roles above: payroll_manager has "payroll.structure.edit" in
-- role_permissions and the editEmployee action already gates salary
-- fields on admin/payroll_manager (isAdminOrPayroll), but no RLS UPDATE
-- policy on public.employees has ever included payroll_manager — only
-- admin/hr_manager (20260722162724_payroll_core.sql). A payroll_manager
-- editing an employee today has every field silently dropped by RLS;
-- the update affects zero rows and reports success. Fixing it here
-- since it's the same table and the same class of "role exists in the
-- UI/permissions model but was never wired into RLS" gap as everything
-- else this session — not a business-logic change, just closing the gap
-- between what the app already assumes and what RLS actually allows.
create policy "payroll managers can update employees"
on public.employees for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "compensation managers can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']));

-- benefit_plans' own SELECT policy is already org-wide (core.is_org_member),
-- same as job_grades — only write access needs granting here.
create policy "compensation managers can create benefit plans"
on public.benefit_plans for insert
to authenticated
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can update benefit plans"
on public.benefit_plans for update
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']))
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can view all benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can enroll employees"
on public.employee_benefit_enrollments for insert
to authenticated
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

create policy "compensation managers can cancel benefit enrollments"
on public.employee_benefit_enrollments for update
to authenticated
using (core.has_org_role(org_id, array['compensation_benefits_manager']))
with check (core.has_org_role(org_id, array['compensation_benefits_manager']));

-- Salary masking exists to keep HR out of compensation data it doesn't
-- need (see 20260802010000_auditor_read_access.sql's identical
-- reasoning for auditor) — a Compensation & Benefits Manager's entire
-- job is compensation, so it joins the unmask list. Finance Manager
-- deliberately does not: it sees payroll's financial totals through
-- pay_runs/payslips below, never an individual's raw salary structure.
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
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager'])
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
  b.name as branch_name,
  e.employee_id,
  e.photo_path
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id
left join public.branches b on b.id = e.branch_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;

create policy "finance managers can view chart of accounts"
on public.chart_of_accounts for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

-- Budgets: unlike everything else Finance Manager gets (read-only,
-- matching Accountant/Auditor's shape), this is real write and approval
-- power — "Payroll budget approval" is an explicit CFO duty in the
-- spec, and budgets are otherwise admin/payroll_manager-only.
create policy "finance managers can view budgets"
on public.budgets for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can create budgets"
on public.budgets for insert
to authenticated
with check (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can update budgets"
on public.budgets for update
to authenticated
using (core.has_org_role(org_id, array['finance_manager']))
with check (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can delete budgets"
on public.budgets for delete
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view budget lines"
on public.budget_lines for select
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id and core.has_org_role(b.org_id, array['finance_manager'])
  )
);

create policy "finance managers can create budget lines"
on public.budget_lines for insert
to authenticated
with check (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id and core.has_org_role(b.org_id, array['finance_manager'])
  )
);

create policy "finance managers can update budget lines"
on public.budget_lines for update
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id and core.has_org_role(b.org_id, array['finance_manager'])
  )
)
with check (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id and core.has_org_role(b.org_id, array['finance_manager'])
  )
);

create policy "finance managers can delete budget lines"
on public.budget_lines for delete
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id and core.has_org_role(b.org_id, array['finance_manager'])
  )
);

create policy "finance managers can view reconciliations"
on public.bank_reconciliations for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view statement lines"
on public.bank_statement_lines for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view fixed assets"
on public.fixed_assets for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view depreciation runs"
on public.depreciation_runs for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view depreciation lines"
on public.depreciation_lines for select
to authenticated
using (
  exists (
    select 1 from public.depreciation_runs r
    where r.id = depreciation_run_id and core.has_org_role(r.org_id, array['finance_manager'])
  )
);

-- Payroll's financial totals — gross/net/statutory amounts already sit
-- on payslips regardless of an individual employee's salary_masked flag
-- (masking only hides raw structure fields on employees_masked), so
-- this grant doesn't touch masking at all.
create policy "finance managers can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "finance managers can view expenses"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

-- "Audit preparation" is an explicit Finance Manager duty in the spec.
create or replace function public.get_org_audit_log(p_org_id uuid, p_limit int default 200, p_before timestamptz default null)
returns table (
  created_at timestamptz,
  action text,
  log_type text,
  actor_id uuid,
  actor_username text,
  actor_via_sso boolean,
  ip_address text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not core.has_org_role(p_org_id, array['admin', 'auditor', 'finance_manager']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    a.created_at,
    a.payload->>'action' as action,
    a.payload->>'log_type' as log_type,
    safe_actor.actor_id,
    a.payload->>'actor_username' as actor_username,
    case lower(coalesce(a.payload->>'actor_via_sso', ''))
      when 'true' then true
      when 'false' then false
      else null
    end as actor_via_sso,
    a.ip_address::text as ip_address
  from auth.audit_log_entries a
  cross join lateral (
    select case
      when (a.payload->>'actor_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (a.payload->>'actor_id')::uuid
      else null
    end as actor_id
  ) as safe_actor
  where exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id and m.user_id = safe_actor.actor_id
  )
  and (p_before is null or a.created_at < p_before)
  order by a.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.get_org_audit_log(uuid, int, timestamptz) from public, anon;
grant execute on function public.get_org_audit_log(uuid, int, timestamptz) to authenticated;
