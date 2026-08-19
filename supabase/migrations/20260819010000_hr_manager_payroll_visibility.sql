-- Closes a nav/RLS mismatch: Loans & Advances and Expenses already sit in
-- REQUESTS_ITEMS, which hr_manager gets by default (nav-sections.ts), and
-- Payroll Runs is reachable the moment an admin grants an hr_manager the
-- "payroll" section via Security & Access's per-user override — but
-- hr_manager was never added to the pay_runs/payslips/loans/expenses SELECT
-- policies (those stayed admin/payroll_manager/accountant/auditor-only, or
-- admin/payroll_manager/accountant/finance_manager for expenses, or +chro
-- for pay_runs/payslips). The result: the sidebar link renders, the page
-- loads, and the query comes back empty/blocked — reported as "menu did
-- not open" / "unable to access the data".
--
-- Read-only, on purpose: hr_manager gains visibility, not the ability to
-- approve. Loans/expenses approval stays admin/payroll_manager/accountant-
-- only, the same boundary 20260802020000_department_manager_scope.sql
-- already drew for department managers ("loans/expenses/overtime approval
-- stay admin/payroll_manager-only"). Every policy below is additive.
create policy "hr managers can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['hr_manager']));

create policy "hr managers can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['hr_manager']));

create policy "hr managers can view all loans"
on public.loans for select
to authenticated
using (core.has_org_role(org_id, array['hr_manager']));

create policy "hr managers can view all expense claims"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['hr_manager']));
