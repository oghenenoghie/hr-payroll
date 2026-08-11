-- Wires up the Department Manager role for real — was originally written
-- believing nothing anywhere checked for it yet. In the combined history
-- (this migration merged from a branch that diverged before
-- 20260730020000_department_manager.sql landed), that migration already
-- had: departments.manager_id (an explicit, admin-assigned "head of
-- department" column — see departments/actions.ts), a
-- core.is_manager_of_department(department_id) helper built on it, and
-- "department managers can view their department's employees" /
-- "...leave requests" policies plus a review_leave_request() branch, all
-- using that explicit-assignment model.
--
-- core.is_department_manager_of(employee_id) below is NOT redundant with
-- that, even though it originally duplicated the same two policies under
-- different logic (a looser "any co-department employee holding the
-- department_manager role" check that never looked at manager_id at
-- all) — every later migration in this branch's history (Employee
-- Relations, Shift Scheduling, LMS, LMS quizzes) calls this exact
-- function by name as the standard department-scope check, so the
-- signature has to stay. What changed here: its BODY now delegates to
-- departments.manager_id — the one real, UI-assigned head — instead of
-- the looser peer check, so every one of those later call sites
-- inherits the same correction without touching them. The two duplicate
-- policies from the original version of this migration are removed
-- below (base's equivalent policies, now backed by the same
-- manager_id-based logic, already cover both).
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
  );
$$;

revoke all on function core.is_department_manager_of(uuid) from public, anon;
grant execute on function core.is_department_manager_of(uuid) to authenticated;

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
