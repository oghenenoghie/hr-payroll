-- Integrations (bank disbursement demo). This is deliberately illustrative
-- only — toggling a connection here never calls a real bank API, moves
-- money, or generates a disbursement file. It exists so the platform's
-- Integrations screen is a real, org-scoped toggle rather than static
-- copy, while staying honest about what it actually does (see the "Demo
-- integration" banner on the /integrations page itself).
--
-- Admin-only, matching product-and-ia.md's role table ("Admin | ... |
-- Integrations & security"). No other role sees or manages this.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('gtbank', 'access_bank', 'zenith_bank')),
  connected boolean not null default false,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index integration_connections_org_id_idx on public.integration_connections (org_id);

alter table public.integration_connections enable row level security;

create policy "admins can view their org's integration connections"
on public.integration_connections for select
to authenticated
using (core.has_org_role(org_id, array['admin']));

create policy "admins can create integration connections"
on public.integration_connections for insert
to authenticated
with check (updated_by = auth.uid() and core.has_org_role(org_id, array['admin']));

create policy "admins can update integration connections"
on public.integration_connections for update
to authenticated
using (core.has_org_role(org_id, array['admin']))
with check (core.has_org_role(org_id, array['admin']));
