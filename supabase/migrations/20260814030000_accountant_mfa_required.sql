-- Accountant gets full Payroll Manager parity on mandatory MFA — the base
-- branch's intent when it hardcoded accountant into the (app) layout's
-- MFA gate directly. mfaRequired is data-driven off roles.mfa_required
-- (see 20260729010000_roles_and_permissions.sql and lib/membership.ts),
-- so the actual fix is here, not a second hardcoded role check alongside
-- the one that already reads this column.
update public.roles set mfa_required = true where key = 'accountant';
