-- Department Manager: a new role scoped to a single department, distinct
-- from the existing generic "manager" concept (core.is_manager_of(), any
-- employee with direct reports via employees.manager_id, regardless of
-- role — untouched by this migration). A department manager is granted
-- the role explicitly (via departments/actions.ts, admin-only) and their
-- authority is scoped to the one department they're assigned to head,
-- via this new explicit head-of-department column — not "any org member
-- who happens to hold the department_manager role and shares a
-- department", which has no defined head and would let two people in
-- the same department both claim manager authority over each other.
alter table public.departments
  add column manager_id uuid references public.employees (id) on delete set null;

-- Canonical "is the caller the manager of this employee's department"
-- check — the name (is_department_manager_of, keyed by employee id
-- rather than department id) and RLS wiring for it live in
-- 20260802020000_department_manager_scope.sql, defined here instead so
-- that migrations between here and there (the configurable approval
-- engine) can call it by its final name. Mirrors core.is_manager_of()'s
-- exact shape/security-definer rationale (a policy on public.employees
-- that queries public.employees or public.departments to find the
-- caller's own employee row would re-trigger RLS on that inner query,
-- including this very policy, causing infinite recursion).
create or replace function core.is_department_manager_of(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees report
    join public.departments d on d.id = report.department_id
    join public.employees mgr on mgr.id = d.manager_id
    where report.id = p_employee_id
      and mgr.user_id = auth.uid()
      and core.has_org_role(report.org_id, array['department_manager'])
  );
$$;

revoke all on function core.is_department_manager_of(uuid) from public, anon;
grant execute on function core.is_department_manager_of(uuid) to authenticated;
