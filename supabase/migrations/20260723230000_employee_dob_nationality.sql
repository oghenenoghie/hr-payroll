-- Employee master data — feature-backlog.md §2's HR-core gap: "DOB
-- (pension eligibility), nationality (expatriate treatment), and state
-- of residence vs state of origin vs work location — three different
-- things, and PAYE routes on residence." This adds DOB and nationality
-- capture only.
--
-- Deliberately data capture, not new compliance logic, disclosed
-- honestly rather than guessed at: neither PenCom's exact age-based
-- pension eligibility rule nor the specific expatriate PAYE treatment
-- an employee's nationality would trigger is resolved anywhere in this
-- codebase yet, and both are the kind of statutory specifics this skill
-- says must be confirmed against primary guidance before being encoded
-- into packages/compliance — not guessed at here. Capturing the data
-- now means the day that logic is added, the fields already exist
-- instead of requiring a second, disruptive schema change.
alter table public.employees
  add column date_of_birth date,
  add column nationality text;

-- Not salary-sensitive, so both pass through employees_masked unmasked
-- for every role — appended at the end because Postgres views can't
-- have a column inserted mid-list without a full column-order-preserving
-- replace (see the departments migration's note on this).
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
  e.nationality
from public.employees e
left join public.departments d on d.id = e.department_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
