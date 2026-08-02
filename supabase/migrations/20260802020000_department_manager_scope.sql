-- Wires up the Department Manager role for real. It already existed as a
-- roles-table row, a nav-sections default (["requests"]), and seeded
-- role_permissions ('employee.record.view.department',
-- 'leave.approve.department') — but nothing anywhere actually checked for
-- it: no RLS policy, no Server Action authorization branch, no page query.
--
-- Department Manager is a distinct org_membership.role, not the same
-- concept as 20260723090000_manager_self_service.sql's "manager" (any
-- employee, of any role, that another employee's manager_id points at).
-- Its scope is the whole department the caller's own linked employee row
-- belongs to, not just direct reports — matching what role_permissions
-- already names it: "View employee records within own department" /
-- "Approve requests within own department only", not "...direct
-- reports". A department manager with zero direct reports still manages
-- their department.
--
-- Every policy below is additive (new "department managers can ..."
-- policy per table, nothing dropped or replaced), the same pattern
-- core.is_manager_of() established — Postgres unions permissive
-- policies, so this can only grant a new read/approval path, never
-- narrow anyone else's existing access. Deliberately scoped to
-- employees + leave_requests only, matching the two permissions actually
-- seeded for this role — loans/expenses/overtime approval stay
-- admin/payroll_manager-only, the same split manager self-service
-- already draws.
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
    join public.employees mgr on mgr.department_id = report.department_id
    where report.id = p_employee_id
      and report.department_id is not null
      and mgr.user_id = auth.uid()
      and core.has_org_role(report.org_id, array['department_manager'])
  );
$$;

revoke all on function core.is_department_manager_of(uuid) from public, anon;
grant execute on function core.is_department_manager_of(uuid) to authenticated;

create policy "department managers can view their department"
on public.employees for select
to authenticated
using (core.is_department_manager_of(employees.id));

create policy "department managers can view their department's leave requests"
on public.leave_requests for select
to authenticated
using (core.is_department_manager_of(leave_requests.employee_id));

-- Same shape as review_leave_request's existing is_manager_of() branch:
-- OR in the department-scope check alongside the pre-existing
-- admin/hr_manager and direct-manager authorization, widening who can
-- call this function without changing what it does for anyone already
-- authorized.
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
    or core.is_department_manager_of(v_leave.employee_id)
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

revoke all on function public.review_leave_request(uuid, boolean) from public, anon;
grant execute on function public.review_leave_request(uuid, boolean) to authenticated;
