-- Per-user nav access, layered on top of each role's default section set
-- (see apps/wagebook/src/lib/nav-sections.ts for the role defaults and the
-- four coarse sections this covers: workforce, payroll, requests,
-- company). A missing row for a given user+section means "use the role
-- default" — this table holds exceptions only, not a full copy of every
-- user's access, so it stays small and the actual rule (role default)
-- stays visible in one place in code rather than duplicated into every
-- row at creation time.
--
-- Nav-level only: this decides what shows in the sidebar, never what a
-- page or server action allows — those keep their own existing role
-- checks and RLS regardless of what's toggled here. Granting a section
-- to someone who fails a page's real permission check just shows them a
-- link that behaves exactly as it would if they'd typed the URL directly
-- today; nothing granted here bypasses any check anywhere else.
create table public.user_nav_overrides (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  section_key text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id, section_key)
);

alter table public.user_nav_overrides enable row level security;

create policy "members can view their own nav overrides, admins any"
on public.user_nav_overrides for select
to authenticated
using (user_id = auth.uid() or core.has_org_role(org_id, array['admin']));

create policy "admins can add nav overrides"
on public.user_nav_overrides for insert
to authenticated
with check (core.has_org_role(org_id, array['admin']));

create policy "admins can update nav overrides"
on public.user_nav_overrides for update
to authenticated
using (core.has_org_role(org_id, array['admin']))
with check (core.has_org_role(org_id, array['admin']));

create policy "admins can remove nav overrides"
on public.user_nav_overrides for delete
to authenticated
using (core.has_org_role(org_id, array['admin']));
