-- Department Manager: a new role scoped to a single department, distinct
-- from the existing generic "manager" concept (core.is_manager_of(), any
-- employee with direct reports via employees.manager_id, regardless of
-- role — untouched by this migration). A department manager is granted
-- the role explicitly (via departments/actions.ts, admin-only — see
-- "only Admin changes anyone's existing role" note below) and their
-- authority is scoped to the one department they're assigned to head.
--
-- Deliberately narrow, mirroring Manager Self-Service's own scope
-- decision (20260723090000's comment: "scoped to leave approvals only,
-- not loans/expenses — Payroll Manager owns loans/expenses"): a
-- department manager can view their department's employees and approve
-- their department's leave requests. Payroll, compliance, reports,
-- company setup and security stay untouched — those remain admin/
-- payroll_manager/hr_manager territory.
alter table public.departments
  add column manager_id uuid references public.employees (id) on delete set null;

-- Mirrors core.is_manager_of()'s exact shape/security-definer rationale
-- (a policy on public.employees that queries public.employees or
-- public.departments to find the caller's own employee row would
-- re-trigger RLS on that inner query, including this very policy,
-- causing infinite recursion).
create or replace function core.is_manager_of_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.departments d
    join public.employees mgr on mgr.id = d.manager_id
    where d.id = p_department_id
      and mgr.user_id = auth.uid()
  );
$$;

revoke all on function core.is_manager_of_department(uuid) from public, anon;
grant execute on function core.is_manager_of_department(uuid) to authenticated;

create policy "department managers can view their department's employees"
on public.employees for select
to authenticated
using (
  core.has_org_role(org_id, array['department_manager'])
  and core.is_manager_of_department(department_id)
);

create policy "department managers can view their department's leave requests"
on public.leave_requests for select
to authenticated
using (
  core.has_org_role(org_id, array['department_manager'])
  and exists (
    select 1 from public.employees e
    where e.id = leave_requests.employee_id
      and core.is_manager_of_department(e.department_id)
  )
);

-- review_leave_request(): full redeclare per 20260723090000's version (the
-- last to touch it), adding a department-manager-scoped authorization
-- branch alongside the existing admin/hr_manager and is_manager_of()
-- branches.
create or replace function public.review_leave_request(p_leave_request_id uuid, p_approve boolean)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leave public.leave_requests;
begin
  select * into v_leave from public.leave_requests where id = p_leave_request_id and status = 'pending';

  if v_leave.id is null then
    raise exception 'Leave request % not found or not pending', p_leave_request_id;
  end if;

  if not (
    core.has_org_role(v_leave.org_id, array['admin', 'hr_manager'])
    or core.is_manager_of(v_leave.employee_id)
    or (
      core.has_org_role(v_leave.org_id, array['department_manager'])
      and exists (
        select 1 from public.employees e
        where e.id = v_leave.employee_id
          and core.is_manager_of_department(e.department_id)
      )
    )
  ) then
    raise exception 'You do not have permission to review this leave request';
  end if;

  if p_approve then
    update public.leave_requests
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_leave_request_id
    returning * into v_leave;

    if v_leave.leave_type = 'annual' then
      update public.employees
      set annual_leave_balance_days = annual_leave_balance_days - v_leave.days
      where id = v_leave.employee_id and annual_leave_balance_days >= v_leave.days;

      if not found then
        raise exception 'Employee has insufficient annual leave balance for this request';
      end if;
    end if;
  else
    update public.leave_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_leave_request_id
    returning * into v_leave;
  end if;

  return v_leave;
end;
$$;

revoke all on function public.review_leave_request(uuid, boolean) from public;
grant execute on function public.review_leave_request(uuid, boolean) to authenticated;
