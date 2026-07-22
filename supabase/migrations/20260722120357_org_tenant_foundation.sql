-- Org/tenant model + RLS foundation (README §7, §9, §14).
--
-- `core` mirrors packages/core: shared RLS helpers, kept in a schema that
-- is never exposed via the Data API (only `public` is exposed), so these
-- functions are reachable only from SQL — RLS policies and other
-- functions — never directly over PostgREST/RPC.
create schema if not exists core;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) > 0),
  rc_number text,
  company_tin text,
  default_pay_frequency text not null default 'monthly'
    check (default_pay_frequency in ('weekly', 'biweekly', 'monthly')),
  default_pfa text,
  states_of_operation text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'payroll_manager', 'hr_manager', 'employee')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_memberships_user_id_idx on public.org_memberships (user_id);
create index org_memberships_org_id_idx on public.org_memberships (org_id);

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;

-- Membership/role checks always key off the current session's auth.uid(),
-- never a caller-supplied user id, so they can't be used to probe other
-- users' access. SECURITY DEFINER is required so RLS on org_memberships
-- doesn't recursively depend on evaluating RLS on org_memberships to
-- answer its own policy check; access is restricted by keeping these in
-- the non-exposed `core` schema and granting execute to `authenticated`
-- only (see the Supabase security checklist on SECURITY DEFINER + public
-- schema functions being globally callable).
create or replace function core.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function core.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

revoke all on function core.is_org_member(uuid) from public;
revoke all on function core.has_org_role(uuid, text[]) from public;
grant execute on function core.is_org_member(uuid) to authenticated;
grant execute on function core.has_org_role(uuid, text[]) to authenticated;

-- organizations policies. No INSERT policy: organizations are only ever
-- created through create_organization() below, which atomically creates
-- the admin membership alongside it — a direct client-side insert would
-- leave an orphaned org with no admin.
create policy "org members can view their organization"
on public.organizations for select
to authenticated
using (core.is_org_member(id));

create policy "org admins can update their organization"
on public.organizations for update
to authenticated
using (core.has_org_role(id, array['admin']))
with check (core.has_org_role(id, array['admin']));

-- org_memberships policies.
create policy "org members can view memberships in their org"
on public.org_memberships for select
to authenticated
using (core.is_org_member(org_id));

create policy "org admins can add memberships"
on public.org_memberships for insert
to authenticated
with check (core.has_org_role(org_id, array['admin']));

create policy "org admins can update memberships"
on public.org_memberships for update
to authenticated
using (core.has_org_role(org_id, array['admin']))
with check (core.has_org_role(org_id, array['admin']));

create policy "org admins can remove memberships"
on public.org_memberships for delete
to authenticated
using (core.has_org_role(org_id, array['admin']));

-- Atomic org bootstrap: creates the organization and its creator's admin
-- membership in one transaction, so an org can never exist without an
-- admin. Exposed in `public` (unlike the core helpers above) because it's
-- meant to be called directly by the client via RPC; execute is granted
-- to `authenticated` only, and it checks auth.uid() itself rather than
-- trusting any caller-supplied identity.
create or replace function public.create_organization(
  p_name text,
  p_rc_number text default null,
  p_company_tin text default null,
  p_default_pay_frequency text default 'monthly',
  p_default_pfa text default null,
  p_states_of_operation text[] default '{}'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, rc_number, company_tin, default_pay_frequency, default_pfa, states_of_operation)
  values (p_name, p_rc_number, p_company_tin, p_default_pay_frequency, p_default_pfa, p_states_of_operation)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
