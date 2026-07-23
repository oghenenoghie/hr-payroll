-- Probation tracking and confirmation — feature-backlog.md §2's
-- "near-blocking" HR gap. Deliberately narrow: a probation end date and a
-- confirmed flag, nothing more. No statutory probation length is legislated
-- in Nigeria the way PAYE bands or pension rates are, so this captures
-- company policy data, not a claimed legal minimum (same posture as
-- GRATUITY_DAYS_PER_YEAR_OF_SERVICE) — the admin sets the date; nothing
-- here infers or defaults one. Not wired into payroll math at all: an
-- employee on probation is paid identically to a confirmed one, since
-- nothing in the Nigeria Tax Act 2025 conditions PAYE/pension/NHF
-- treatment on probation status.
alter table public.employees
  add column probation_end_date date,
  add column confirmed boolean not null default false;

-- Not salary-sensitive, so it passes through unmasked like department_id
-- and job_grade_id — appended at the end of the select list per this
-- view's standing rule (Postgres can't reorder a view's columns without
-- a full column-order-preserving replace).
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
  e.confirmed
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
