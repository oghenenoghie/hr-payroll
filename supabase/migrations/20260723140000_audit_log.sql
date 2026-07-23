-- Org-scoped read access into GoTrue's auth.audit_log_entries.
--
-- auth.audit_log_entries is not exposed to PostgREST and has no org_id —
-- it's one global log for every org sharing this Supabase project. This
-- function does the org scoping itself: an admin only sees rows whose
-- payload->>'actor_id' matches a member of their own org, and it's
-- SECURITY DEFINER (with an explicit authz check up front, matching the
-- create_pay_run fix) so it can read the auth schema at all.
--
-- payload is a free-form json column GoTrue writes; it isn't guaranteed to
-- carry every documented field on every event, so every extraction below
-- degrades to null rather than throwing on a missing or malformed field.
create or replace function public.get_org_audit_log(p_org_id uuid, p_limit int default 200)
returns table (
  created_at timestamptz,
  action text,
  log_type text,
  actor_id uuid,
  actor_username text,
  actor_via_sso boolean,
  ip_address text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not core.has_org_role(p_org_id, array['admin']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    a.created_at,
    a.payload->>'action' as action,
    a.payload->>'log_type' as log_type,
    safe_actor.actor_id,
    a.payload->>'actor_username' as actor_username,
    case lower(coalesce(a.payload->>'actor_via_sso', ''))
      when 'true' then true
      when 'false' then false
      else null
    end as actor_via_sso,
    a.ip_address::text as ip_address
  from auth.audit_log_entries a
  cross join lateral (
    select case
      when (a.payload->>'actor_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (a.payload->>'actor_id')::uuid
      else null
    end as actor_id
  ) safe_actor
  where exists (
    select 1 from public.org_memberships om
    where om.org_id = p_org_id
      and om.user_id = safe_actor.actor_id
  )
  order by a.created_at desc
  limit least(coalesce(p_limit, 200), 500);
end;
$$;

revoke all on function public.get_org_audit_log(uuid, int) from public, anon, authenticated;
grant execute on function public.get_org_audit_log(uuid, int) to authenticated;
