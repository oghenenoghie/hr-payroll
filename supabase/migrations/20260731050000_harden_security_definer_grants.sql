-- Security advisor hardening (no behavior change for authenticated users):
--
-- 1. apply_org_wide_raise, discard_pay_run_draft and reverse_pay_run were
--    inconsistently grantable to `anon`, unlike the other org-scoped
--    SECURITY DEFINER RPCs (create_pay_run, create_organization,
--    review_leave_request, etc). Each already rejects the call internally via
--    core.has_org_role(), which resolves to false for anon (auth.uid() is
--    null), so this was not exploitable — this just brings grants in line
--    with least privilege and the pattern used everywhere else.
--    (approve_pay_run(uuid) isn't listed here: 20260731030000_payroll_variance_detection.sql
--    drops it and recreates it as approve_pay_run(uuid, boolean), already
--    revoked from public/granted to authenticated only, so by the time a
--    fresh database reaches this migration the 1-arg signature no longer
--    exists to revoke from.)
--
-- 2. set_employee_id_default / generate_employee_id had a mutable search_path.
--    Both fully-qualify every reference already, so pinning search_path is safe.
--    These two functions have no CREATE in any migration in this repo (their
--    origin migration appears to have been lost independently of this change)
--    so they don't exist on a from-scratch database. Guard the ALTERs so this
--    migration still no-ops cleanly there instead of failing; they take effect
--    wherever the functions actually exist (e.g. the current live database).

revoke execute on function public.apply_org_wide_raise(uuid, numeric) from anon;
revoke execute on function public.discard_pay_run_draft(uuid) from anon;
revoke execute on function public.reverse_pay_run(uuid, text) from anon;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_employee_id_default'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    alter function public.set_employee_id_default() set search_path = '';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'generate_employee_id'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    alter function public.generate_employee_id() set search_path = '';
  end if;
end $$;
