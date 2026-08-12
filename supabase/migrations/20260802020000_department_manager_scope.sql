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
-- heads, matching what role_permissions already names it: "View employee
-- records within own department" / "Approve requests within own
-- department only", not "...direct reports". A department manager with
-- zero direct reports still manages their department.
--
-- core.is_department_manager_of() itself — an explicit "is the caller
-- the head of this employee's department" check keyed off
-- departments.manager_id — was defined earlier, in
-- 20260730021000_department_manager.sql (the migration that added the
-- manager_id column it depends on), so the configurable approval engine
-- (20260731020000/20260731040000) could call it by its final name for
-- leave requests' department-manager approval branch. This migration
-- only adds the two read policies actually gated on it; it does NOT
-- redeclare review_leave_request() — that function's current body
-- (20260731020000_configurable_approval_engine.sql) already routes
-- every approval, including the department-manager branch, through
-- core.is_eligible_leave_approver()/is_eligible_request_approver(),
-- which already call core.is_department_manager_of(). Redeclaring it
-- here with the old pre-approval-engine 3-way check would silently
-- revert every leave request to bypassing the multi-step workflow
-- engine entirely.
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
create policy "department managers can view their department"
on public.employees for select
to authenticated
using (core.is_department_manager_of(employees.id));

create policy "department managers can view their department's leave requests"
on public.leave_requests for select
to authenticated
using (core.is_department_manager_of(leave_requests.employee_id));
