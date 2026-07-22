-- Supabase grants EXECUTE on new public-schema functions to anon and
-- authenticated via default privileges at object-creation time — this is
-- separate from (and not undone by) `revoke ... from public`. The prior
-- migration's revoke didn't actually strip anon's access; do it
-- explicitly here and confirm.
revoke execute on function public.create_organization(text, text, text, text, text, text[]) from anon;

revoke execute on function core.is_org_member(uuid) from anon, authenticated;
grant execute on function core.is_org_member(uuid) to authenticated;

revoke execute on function core.has_org_role(uuid, text[]) from anon, authenticated;
grant execute on function core.has_org_role(uuid, text[]) to authenticated;
