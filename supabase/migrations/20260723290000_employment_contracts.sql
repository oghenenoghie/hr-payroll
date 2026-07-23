-- Employment contracts and contract-expiry alerting — feature-backlog.md
-- §2's "near-blocking" HR gap. Deliberately narrow, mirroring the
-- probation-tracking phase's posture: employment_type is descriptive
-- classification only (permanent / contract / intern), not wired into any
-- PAYE/pension/NHF logic — whether contract-vs-permanent status changes
-- statutory treatment is a genuinely open question this build doesn't
-- guess at (feature-backlog.md's HR-core table flags this explicitly).
-- "Alerting" here means a directory badge (mirroring ProbationBadge), not
-- a scheduled push notification — nothing in this app runs a background
-- job that could fire one.
alter table public.employees
  add column employment_type text not null default 'permanent'
    check (employment_type in ('permanent', 'contract', 'intern')),
  add column contract_end_date date;

-- Not salary-sensitive, so it passes through unmasked — appended at the
-- end of the select list per this view's standing column-order-preserving
-- rule.
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
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
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
  e.contract_end_date
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
