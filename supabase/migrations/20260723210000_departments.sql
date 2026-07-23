-- Departments / cost centres — feature-backlog.md §2's "blocking" HR-core
-- gap: "Pay-run scoping already offers 'single department', and payroll
-- accounting needs cost-centre allocation. Both reference an entity that
-- doesn't exist." A simple admin/hr_manager-managed catalog, the same
-- shape as benefit_plans: an org-scoped list, employees optionally
-- assigned to one, referenced by the GL export as a cost centre.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index departments_org_id_idx on public.departments (org_id);

alter table public.departments enable row level security;

create policy "org members can view departments"
on public.departments for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and HR managers can create departments"
on public.departments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update departments"
on public.departments for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can delete departments"
on public.departments for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

alter table public.employees
  add column department_id uuid references public.departments (id) on delete set null;

-- Not salary-sensitive, so it passes through employees_masked unmasked for
-- every role — recreated in full because Postgres views can't have a
-- column appended without a full replace.
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
  d.name as department_name
from public.employees e
left join public.departments d on d.id = e.department_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
