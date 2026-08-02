-- Extends direct-manager self-service (20260723090000_manager_self_service.sql)
-- from leave-only to overtime as well.
--
-- That earlier migration deliberately scoped manager approval to leave,
-- reasoning "Payroll Manager owns loans/expenses; HR/leave is where a
-- direct manager's approval naturally extends." A subsequent role/module
-- gap review (see the Full Feature Map's Manager Self-Service entry)
-- flagged overtime specifically as the one exception worth closing: it's
-- a day-to-day scheduling decision a direct manager is naturally placed
-- to judge, unlike loans/expenses which stay a payroll/finance decision.
-- Loans and expenses remain admin/payroll_manager-only, unchanged.
--
-- Unlike review_leave_request(), no security-definer function is needed
-- here: approving overtime only ever updates the overtime_requests row
-- itself (status, rate_multiplier_bps, approved_by, approved_at) — it
-- never touches a table (like employees.annual_leave_balance_days) that
-- a manager lacks a general UPDATE right on. Plain additive RLS SELECT +
-- UPDATE policies, mirroring the shape of the existing admin/
-- payroll_manager policies on this same table, are sufficient — the
-- existing approveOvertime/rejectOvertime Server Actions (a bare
-- .update().eq("id", ...) with no in-code role check) already rely
-- entirely on RLS, so no app-code change is needed for the write path
-- to start working for a manager once these policies exist.
drop policy if exists "managers can view their direct reports' overtime requests" on public.overtime_requests;
create policy "managers can view their direct reports' overtime requests"
on public.overtime_requests for select
to authenticated
using (core.is_manager_of(overtime_requests.employee_id));

drop policy if exists "managers can update their direct reports' overtime requests" on public.overtime_requests;
create policy "managers can update their direct reports' overtime requests"
on public.overtime_requests for update
to authenticated
using (core.is_manager_of(overtime_requests.employee_id))
with check (core.is_manager_of(overtime_requests.employee_id));
