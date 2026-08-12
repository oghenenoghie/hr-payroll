-- Per-role dashboards, super-admin configurable — every role from
-- Super Admin down to Finance Manager now sees a /dashboard built from
-- widgets relevant to their own domain (pending approvals, payroll,
-- workforce, compliance, accounts, budgets, compensation, recruitment,
-- performance, or — for Department Manager — their own department),
-- instead of the same three static org-info fields every role saw
-- before.
--
-- dashboard_widget_visibility is the same shape and convention as
-- 20260801010000_module_role_visibility.sql, with one deliberate
-- difference: module_role_visibility's default (zero rows) means
-- "visible to everyone," safe for a reference page. A dashboard widget's
-- default is the widget's own defaultRoles in
-- apps/wagebook/src/lib/dashboard-widgets.ts instead — not every widget
-- makes sense for every role, so "untouched" means "sensible narrow
-- default," not "wide open." An org row for a widget replaces that
-- default entirely, the same "zero rows = default, any rows =
-- authoritative" shape either way.
--
-- Presentation-only, same as module visibility: this decides what
-- renders on /dashboard, never what a role can actually query — every
-- widget's own data fetch still goes through the exact same RLS every
-- other page in this app already relies on, so a widget shown to a role
-- it wasn't intended for would at worst render an empty/zero state, not
-- leak anything.
create table public.dashboard_widget_visibility (
  org_id uuid not null references public.organizations (id) on delete cascade,
  widget_key text not null,
  role_key text not null references public.roles (key),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  primary key (org_id, widget_key, role_key)
);

create index dashboard_widget_visibility_org_id_idx on public.dashboard_widget_visibility (org_id);

alter table public.dashboard_widget_visibility enable row level security;

create policy "org members can view dashboard widget visibility"
on public.dashboard_widget_visibility for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins can add dashboard widget visibility"
on public.dashboard_widget_visibility for insert
to authenticated
with check (core.has_org_role(org_id, array['admin']));

create policy "admins can remove dashboard widget visibility"
on public.dashboard_widget_visibility for delete
to authenticated
using (core.has_org_role(org_id, array['admin']));
