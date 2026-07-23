-- Defense-in-depth: application logic in payroll/new/actions.ts already
-- orders deductions (statutory, never skipped -> loans, capped against
-- remaining net -> benefits, whole enrollments skipped rather than
-- partially charged) so net pay can never go negative, but until now
-- nothing in the schema enforced it -- a future code path that forgets the
-- ordering would silently persist a negative net_kobo. This constraint
-- makes that impossible regardless of what application code does.
alter table public.payslips
  add constraint payslips_net_kobo_non_negative check (net_kobo >= 0);
