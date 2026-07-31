-- Security advisor hardening (no behavior change for authenticated users):
--
-- 1. apply_org_wide_raise, approve_pay_run, discard_pay_run_draft and
--    reverse_pay_run were inconsistently grantable to `anon`, unlike the
--    other org-scoped SECURITY DEFINER RPCs (create_pay_run, create_organization,
--    review_leave_request, etc). Each already rejects the call internally via
--    core.has_org_role(), which resolves to false for anon (auth.uid() is
--    null), so this was not exploitable — this just brings grants in line
--    with least privilege and the pattern used everywhere else.
--
-- 2. set_employee_id_default / generate_employee_id had a mutable search_path.
--    Both fully-qualify every reference already, so pinning search_path is safe.

revoke execute on function public.apply_org_wide_raise(uuid, numeric) from anon;
revoke execute on function public.approve_pay_run(uuid) from anon;
revoke execute on function public.discard_pay_run_draft(uuid) from anon;
revoke execute on function public.reverse_pay_run(uuid, text) from anon;

alter function public.set_employee_id_default() set search_path = '';
alter function public.generate_employee_id() set search_path = '';
