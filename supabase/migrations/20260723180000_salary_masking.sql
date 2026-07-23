-- Field-level salary masking — hr-modules.md's central point on employee
-- master data: "An HR Manager may legitimately need employee records
-- without seeing executive compensation. Given how sensitive payroll is,
-- field-level permissions and salary masking are closer to table stakes
-- than to a premium feature." RLS isolates tenants and roles gate whole
-- screens today, but nothing masks a single field within an authorised
-- role — this is that first slice.
--
-- Scope, disclosed honestly: this masks *reads* for hr_manager specifically
-- (admin and payroll_manager always see real values) via a database view,
-- and separately restricts *writes* to salary fields in the edit action
-- (see employees/[id]/edit/actions.ts) so hr_manager can't blind-overwrite
-- what they can't see. It is not a general column-permission system —
-- masking is hardcoded to the hr_manager role and the salary/bank column
-- set below, not configurable per role or per field.
alter table public.employees
  add column salary_masked boolean not null default false;

-- security_invoker is explicit (not just the Postgres default) so this
-- view is evaluated with the *querying* user's RLS visibility, never the
-- view-defining role's — the same reasoning as every SECURITY DEFINER
-- function elsewhere in this schema getting an explicit authorization
-- check rather than relying on an implicit default. Row visibility is
-- still entirely up to the base table's existing RLS policies; this view
-- only adds column-level masking on top.
create view public.employees_masked
with (security_invoker = true)
as
select
  id,
  org_id,
  full_name,
  email,
  state_of_residence,
  hire_date,
  status,
  tin,
  tin_valid_from,
  tin_valid_to,
  pfa,
  manager_id,
  user_id,
  linked_at,
  annual_leave_balance_days,
  created_at,
  salary_masked,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else basic_kobo end as basic_kobo,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else housing_kobo end as housing_kobo,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else transport_kobo end as transport_kobo,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else annual_rent_kobo end as annual_rent_kobo,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else bank_name end as bank_name,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else bank_account_number end as bank_account_number,
  case when salary_masked and not core.has_org_role(org_id, array['admin', 'payroll_manager'])
    then null else bank_account_name end as bank_account_name
from public.employees;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
