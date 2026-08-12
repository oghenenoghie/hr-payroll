-- Accountant has full Payroll Manager parity per
-- 20260730000000_new_org_roles.sql ("everywhere payroll_manager appears
-- in a role check, accountant is added alongside it"), but
-- 20260729010000_roles_and_permissions.sql's original seed predates that
-- rule and left accountant's mfa_required at the column default (false)
-- — a payroll-processing role with real salary/bank-account visibility
-- that should never have been MFA-optional. layout.tsx's MFA gate reads
-- roles.mfa_required directly (data, not a hardcoded role list), so
-- fixing the seed is the correct place for this, not another code path.
update public.roles set mfa_required = true where key = 'accountant';
