-- Manager Self-Service: "Team overview and approvals in one place." Manager
-- isn't a fifth org_membership role — it's any employee (any role) that
-- other employees.manager_id rows point at. These policies are additive
-- (separate policies OR'd with the existing ones, nothing dropped) so an
-- employee who happens to manage people gets extra visibility/authority
-- over their own direct reports without touching anyone else's access.
--
-- Deliberately scoped to leave approvals only, not loans/expenses — that
-- mirrors the existing split in this app (Payroll Manager owns loans/
-- expenses; HR/leave is where a direct manager's approval naturally
-- extends), not an oversight.
--
-- core.is_manager_of() is security definer for the same reason
-- core.has_org_role() is: a policy on public.employees that queries
-- public.employees itself (to find the caller's own employee row, then
-- compare manager_id) re-triggers RLS on that inner query, including this
-- very policy, causing infinite recursion. Running the check as security
-- definer bypasses RLS for the inner lookup only — it grants no privilege
-- beyond "yes/no is this caller employee_id's manager", never row data.
create or replace function core.is_manager_of(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees report
    join public.employees mgr on report.manager_id = mgr.id
    where report.id = p_employee_id
      and mgr.user_id = auth.uid()
  );
$$;

revoke all on function core.is_manager_of(uuid) from public, anon;
grant execute on function core.is_manager_of(uuid) to authenticated;

create policy "managers can view their direct reports"
on public.employees for select
to authenticated
using (core.is_manager_of(employees.id));

create policy "managers can view their direct reports' leave requests"
on public.leave_requests for select
to authenticated
using (core.is_manager_of(leave_requests.employee_id));

-- A manager approving their report's annual leave needs the balance
-- decrement to go through, but a plain 'employee'-role manager has no
-- general UPDATE right on public.employees (rightly so — that would let
-- them edit a report's salary or TIN too, not just their leave balance).
-- review_leave_request() therefore moves to security definer with an
-- explicit authorization check at the top (admin/hr_manager of the org,
-- OR the report's manager) — the same privilege boundary RLS enforced
-- before, just checked explicitly instead of left to policy filtering,
-- so the balance write below can safely bypass the too-broad general
-- employees policy without widening what a manager can otherwise touch.
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

  if not (core.has_org_role(v_leave.org_id, array['admin', 'hr_manager']) or core.is_manager_of(v_leave.employee_id)) then
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
