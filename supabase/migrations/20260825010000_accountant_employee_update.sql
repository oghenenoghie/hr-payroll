-- Fixes a gap in the "payroll managers can update employees" policy from
-- 20260803020000_compensation_and_finance_roles.sql: that migration
-- explicitly closed the same hole for payroll_manager ("no RLS UPDATE
-- policy on public.employees has ever included payroll_manager... the
-- update affects zero rows and reports success") but missed accountant,
-- even though 20260730000000_new_org_roles.sql states accountant has
-- "full Payroll Manager parity — everywhere payroll_manager appears in a
-- role check, accountant is added alongside it". The app already trusts
-- this: editEmployee's isAdminOrPayroll (apps/wagebook/src/app/(app)/
-- employees/[id]/edit/actions.ts) and canControlMasking in edit/page.tsx
-- both treat accountant as able to edit salary fields and the masking
-- flag, but until now an accountant submitting the edit form had every
-- field silently dropped by RLS and the app reported success anyway.
drop policy if exists "payroll managers can update employees" on public.employees;
create policy "payroll managers can update employees"
on public.employees for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));
