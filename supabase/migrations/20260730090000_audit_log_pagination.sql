-- Audit log pagination — get_org_audit_log was hard-capped at 200 rows
-- with no way to see anything older, baked directly into the function's
-- own signature rather than a page-level limit the UI could work around.
--
-- auth.audit_log_entries has no org_id of its own (one global log per
-- Supabase project, scoped here via a join through org_memberships) and
-- is large/unbounded across every org sharing the project, so an exact
-- COUNT(*) for real page-number pagination would itself be an expensive
-- full scan on every page load. Cursor-based ("older than this event")
-- pagination avoids that entirely: p_before, when given, only returns
-- events strictly before that timestamp — the UI passes the last-seen
-- row's created_at to page backward through history one batch at a
-- time, no count query needed.
--
-- p_before defaults to null (today's behavior — most recent p_limit
-- events), so this stays a pure signature extension: every existing
-- caller passing just (p_org_id) or (p_org_id, p_limit) is unaffected.
--
-- Idempotent (create or replace), matching every migration since
-- 20260730010000: this project's operator applies migrations by hand in
-- the SQL Editor, so a half-applied or repeated run must be safe to redo
-- from the top.
--
-- Postgres identifies a function by name AND parameter signature — since
-- this adds a third parameter, "create or replace" alone would create a
-- second, overloaded function instead of replacing the original, and any
-- call using the original two-argument form would then fail with
-- "function is not unique". The old two-argument signature is dropped
-- explicitly first so only one get_org_audit_log ever exists.
drop function if exists public.get_org_audit_log(uuid, int);

create or replace function public.get_org_audit_log(p_org_id uuid, p_limit int default 200, p_before timestamptz default null)
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
  and (p_before is null or a.created_at < p_before)
  order by a.created_at desc
  limit least(coalesce(p_limit, 200), 500);
end;
$$;

revoke all on function public.get_org_audit_log(uuid, int, timestamptz) from public, anon, authenticated;
grant execute on function public.get_org_audit_log(uuid, int, timestamptz) to authenticated;
