-- Job grades and salary bands — feature-backlog.md §2's "near-blocking"
-- HR gap. Same shape as departments: an org-scoped, admin/hr_manager-
-- managed catalog, employees optionally assigned to one. Unlike
-- departments, a grade carries a min/max annual salary band, so it's
-- not purely a label — the employee edit page compares an assigned
-- employee's actual annual contractual pay (basic + housing + transport,
-- the same total used throughout this codebase's daily-rate formulas)
-- against their grade's band and flags it non-blockingly when it falls
-- outside, giving the structure real compliance teeth rather than
-- decorative-only categorisation.
create table public.job_grades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  min_annual_kobo bigint not null check (min_annual_kobo >= 0),
  max_annual_kobo bigint not null check (max_annual_kobo >= min_annual_kobo),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index job_grades_org_id_idx on public.job_grades (org_id);

alter table public.job_grades enable row level security;

create policy "org members can view job grades"
on public.job_grades for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and HR managers can create job grades"
on public.job_grades for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update job grades"
on public.job_grades for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can delete job grades"
on public.job_grades for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

alter table public.employees
  add column job_grade_id uuid references public.job_grades (id) on delete set null;

-- Not salary-sensitive as a label (job_grade_name), so it passes
-- through unmasked — but the band values themselves (min/max) are read
-- directly from public.job_grades by the edit page, not through this
-- view, so no separate masking decision is needed for them here.
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
  jg.name as job_grade_name
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;
