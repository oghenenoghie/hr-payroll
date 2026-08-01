-- Feature-map module visibility (super-admin configurable, per org).
--
-- The Full Feature Map (/featuremap) lists ~36 modules describing what
-- this build covers. By default every module is visible to every role —
-- this table only ever *restricts* that: a module with zero rows here
-- stays visible to everyone (so shipping this migration doesn't hide
-- anything for an org that's never touched the new admin screen at
-- /security/modules), and a module with at least one row becomes visible
-- only to the role(s) explicitly listed.
--
-- module_key is a stable slug matching the MODULES array in
-- apps/wagebook/src/lib/feature-modules.ts — not a foreign key, since
-- that catalog itself is code, not a database table.
--
-- Presentation-only, matching the existing user_nav_overrides convention:
-- this filters rows on the feature-map page itself. It does not gate any
-- real route, Server Action or RLS policy anywhere else in the app —
-- every existing per-page/per-action role check keeps working exactly as
-- it does today.
create table if not exists public.module_role_visibility (
  org_id uuid not null references public.organizations (id) on delete cascade,
  module_key text not null,
  role_key text not null references public.roles (key),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  primary key (org_id, module_key, role_key)
);

create index if not exists module_role_visibility_org_id_idx on public.module_role_visibility (org_id);

alter table public.module_role_visibility enable row level security;

drop policy if exists "org members can view module visibility" on public.module_role_visibility;
create policy "org members can view module visibility"
on public.module_role_visibility for select
to authenticated
using (core.is_org_member(org_id));

drop policy if exists "admins can add module visibility" on public.module_role_visibility;
create policy "admins can add module visibility"
on public.module_role_visibility for insert
to authenticated
with check (core.has_org_role(org_id, array['admin']));

drop policy if exists "admins can remove module visibility" on public.module_role_visibility;
create policy "admins can remove module visibility"
on public.module_role_visibility for delete
to authenticated
using (core.has_org_role(org_id, array['admin']));
