-- Budgets v1 — planned vs. actual by account, the first accounting
-- module in this build that doesn't post anything to the general
-- ledger. A budget is a named plan over a date range with one target
-- amount per revenue or expense account (no monthly/quarterly
-- breakdown in this v1 — the whole period is a single number per
-- account, a disclosed simplification). The comparison against actuals
-- is computed live from ledger_postings the same way Profit & Loss
-- already does, so a budget can never drift out of sync with what
-- actually posted.
--
-- Scoped to revenue and expense accounts only (an operating/P&L budget,
-- the most common first budget a business builds) — capital budgets,
-- cash budgets and balance-sheet targets aren't covered, disclosed on
-- the feature map. Like the chart of accounts itself, account_code on a
-- budget line is deliberately NOT a foreign key to chart_of_accounts:
-- the type check (must be revenue or expense) happens in the
-- application layer at the point a line is added, matching how every
-- other account_code reference in this codebase is validated in
-- TypeScript rather than the database.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS), matching
-- every migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor, so a half-applied or repeated run
-- must be safe to redo from the top.
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  period_start date not null,
  period_end date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists budgets_org_id_idx on public.budgets (org_id);

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  account_code text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now(),
  unique (budget_id, account_code)
);

create index if not exists budget_lines_budget_id_idx on public.budget_lines (budget_id);

alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;

drop policy if exists "admins, payroll managers and accountants can view budgets" on public.budgets;
create policy "admins, payroll managers and accountants can view budgets"
on public.budgets for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add budgets" on public.budgets;
create policy "admins and payroll managers can add budgets"
on public.budgets for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can delete budgets" on public.budgets;
create policy "admins and payroll managers can delete budgets"
on public.budgets for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- budget_lines has no org_id of its own — every policy scopes through
-- its parent budget, the same pattern depreciation_lines already uses
-- for depreciation_runs.
drop policy if exists "admins, payroll managers and accountants can view budget lines" on public.budget_lines;
create policy "admins, payroll managers and accountants can view budget lines"
on public.budget_lines for select
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['admin', 'payroll_manager', 'accountant'])
  )
);

drop policy if exists "admins and payroll managers can add budget lines" on public.budget_lines;
create policy "admins and payroll managers can add budget lines"
on public.budget_lines for insert
to authenticated
with check (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['admin', 'payroll_manager'])
  )
);

drop policy if exists "admins and payroll managers can update budget lines" on public.budget_lines;
create policy "admins and payroll managers can update budget lines"
on public.budget_lines for update
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['admin', 'payroll_manager'])
  )
)
with check (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['admin', 'payroll_manager'])
  )
);

drop policy if exists "admins and payroll managers can delete budget lines" on public.budget_lines;
create policy "admins and payroll managers can delete budget lines"
on public.budget_lines for delete
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['admin', 'payroll_manager'])
  )
);
