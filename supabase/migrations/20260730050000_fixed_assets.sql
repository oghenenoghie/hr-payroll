-- Fixed Assets v1 — a straight-line depreciation register posting real
-- double-entry against the same general ledger everything else in this
-- build uses.
--
--   Acquire  -> nothing posted here; a fixed asset's cost basis enters
--               the books when it's recorded (see note below) — there's
--               no separate "purchase" posting in this v1 the way a
--               vendor bill posts one on approval, since acquisition
--               financing (cash purchase vs. on credit via accounts
--               payable) isn't modelled — that's a disclosed limitation.
--   Depreciate -> a manually triggered, period-based run (like a pay
--               run): straight-line only, (cost - salvage) /
--               useful_life_months per asset, aggregated into one
--               journal entry per run — debit depreciation_expense,
--               credit accumulated_depreciation — mirroring how a pay
--               run posts one aggregate entry rather than one per
--               employee.
--   Dispose  -> removes the asset's cost and accumulated depreciation
--               from the books, records any cash received, and plugs
--               the difference to a single disposal_gain_loss account
--               (debited for a loss, credited for a gain) so the
--               formula is symmetric regardless of which way it goes.
--
-- accumulated_depreciation is chart-typed "asset" (the CHECK constraint
-- has no separate contra-asset type) but is a credit-normal account by
-- construction — every posting to it is a credit. The Balance Sheet page
-- doesn't need to know this: it already sums every asset account by
-- debit-minus-credit, so a credit-only "asset" account nets negative and
-- correctly reduces the fixed asset's carrying value in Total Assets
-- without any special-casing.
--
-- Not built here: accelerated/declining-balance depreciation, mid-month
-- proration (a run always depreciates a full period for every eligible
-- asset regardless of acquisition date within it), asset transfers
-- between cost centres, revaluation, impairment — disclosed on the
-- feature map rather than half-built.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS), matching
-- every migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor, so a half-applied or repeated run
-- must be safe to redo from the top.
create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  category text,
  acquisition_date date not null,
  cost_kobo bigint not null check (cost_kobo > 0),
  salvage_value_kobo bigint not null default 0 check (salvage_value_kobo >= 0),
  useful_life_months integer not null check (useful_life_months > 0),
  accumulated_depreciation_kobo bigint not null default 0 check (accumulated_depreciation_kobo >= 0),
  status text not null default 'active' check (status in ('active', 'disposed')),
  disposed_at date,
  disposal_proceeds_kobo bigint,
  disposal_journal_entry_id uuid references public.journal_entries (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (salvage_value_kobo < cost_kobo)
);

create index if not exists fixed_assets_org_id_idx on public.fixed_assets (org_id);
create index if not exists fixed_assets_status_idx on public.fixed_assets (status);

create table if not exists public.depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_end date not null,
  total_amount_kobo bigint not null check (total_amount_kobo > 0),
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (org_id, period_end)
);

create index if not exists depreciation_runs_org_id_idx on public.depreciation_runs (org_id);

create table if not exists public.depreciation_lines (
  id uuid primary key default gen_random_uuid(),
  depreciation_run_id uuid not null references public.depreciation_runs (id) on delete cascade,
  asset_id uuid not null references public.fixed_assets (id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  created_at timestamptz not null default now()
);

create index if not exists depreciation_lines_run_id_idx on public.depreciation_lines (depreciation_run_id);
create index if not exists depreciation_lines_asset_id_idx on public.depreciation_lines (asset_id);

alter table public.fixed_assets enable row level security;
alter table public.depreciation_runs enable row level security;
alter table public.depreciation_lines enable row level security;

drop policy if exists "admins, payroll managers and accountants can view fixed assets" on public.fixed_assets;
create policy "admins, payroll managers and accountants can view fixed assets"
on public.fixed_assets for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add fixed assets" on public.fixed_assets;
create policy "admins and payroll managers can add fixed assets"
on public.fixed_assets for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Only run_depreciation and dispose_fixed_asset below actually update a
-- fixed asset — this policy exists because they run security invoker (as
-- the calling user, through normal RLS) rather than security definer, so
-- they need something to satisfy. No client ever updates fixed_assets
-- directly.
drop policy if exists "admins and payroll managers can update fixed assets" on public.fixed_assets;
create policy "admins and payroll managers can update fixed assets"
on public.fixed_assets for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view depreciation runs" on public.depreciation_runs;
create policy "admins, payroll managers and accountants can view depreciation runs"
on public.depreciation_runs for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add depreciation runs" on public.depreciation_runs;
create policy "admins and payroll managers can add depreciation runs"
on public.depreciation_runs for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view depreciation lines" on public.depreciation_lines;
create policy "admins, payroll managers and accountants can view depreciation lines"
on public.depreciation_lines for select
to authenticated
using (
  exists (
    select 1 from public.depreciation_runs r
    where r.id = depreciation_run_id
      and core.has_org_role(r.org_id, array['admin', 'payroll_manager', 'accountant'])
  )
);

drop policy if exists "admins and payroll managers can add depreciation lines" on public.depreciation_lines;
create policy "admins and payroll managers can add depreciation lines"
on public.depreciation_lines for insert
to authenticated
with check (
  exists (
    select 1 from public.depreciation_runs r
    where r.id = depreciation_run_id
      and core.has_org_role(r.org_id, array['admin', 'payroll_manager'])
  )
);

-- security invoker (like every other atomic function in this build) —
-- every read/write still goes through the RLS policies above for
-- whoever calls it; this function grants no privilege beyond what the
-- caller's role already has.
create or replace function public.run_depreciation(p_org_id uuid, p_period_end date)
returns public.depreciation_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset record;
  v_amount bigint;
  v_total bigint := 0;
  v_journal_entry_id uuid;
  v_run public.depreciation_runs;
  -- Parallel arrays instead of a temp table: this function is security
  -- invoker and may run inside a caller's larger transaction, and a plain
  -- in-memory array sidesteps any question of a temp table's lifecycle
  -- across repeated calls in the same session.
  v_asset_ids uuid[] := '{}';
  v_amounts bigint[] := '{}';
begin
  for v_asset in
    select * from public.fixed_assets
    where org_id = p_org_id and status = 'active'
      and accumulated_depreciation_kobo < (cost_kobo - salvage_value_kobo)
    order by acquisition_date
  loop
    v_amount := least(
      (v_asset.cost_kobo - v_asset.salvage_value_kobo) / v_asset.useful_life_months,
      v_asset.cost_kobo - v_asset.salvage_value_kobo - v_asset.accumulated_depreciation_kobo
    );
    if v_amount > 0 then
      v_asset_ids := array_append(v_asset_ids, v_asset.id);
      v_amounts := array_append(v_amounts, v_amount);
      v_total := v_total + v_amount;
      update public.fixed_assets
      set accumulated_depreciation_kobo = accumulated_depreciation_kobo + v_amount
      where id = v_asset.id;
    end if;
  end loop;

  if v_total = 0 then
    raise exception 'Nothing to depreciate for period ending %: every active asset is either fully depreciated or none exist', p_period_end;
  end if;

  -- Aggregated into one journal entry for the whole run, mirroring how a
  -- pay run posts one org-level entry rather than one per employee.
  insert into public.journal_entries (org_id, memo, entry_date)
  values (p_org_id, 'Depreciation for period ending ' || p_period_end, p_period_end)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, p_org_id, 'depreciation_expense', 'debit', v_total),
    (v_journal_entry_id, p_org_id, 'accumulated_depreciation', 'credit', v_total);

  insert into public.depreciation_runs (org_id, period_end, total_amount_kobo, journal_entry_id, created_by)
  values (p_org_id, p_period_end, v_total, v_journal_entry_id, auth.uid())
  returning * into v_run;

  insert into public.depreciation_lines (depreciation_run_id, asset_id, amount_kobo)
  select v_run.id, x.asset_id, x.amount_kobo from unnest(v_asset_ids, v_amounts) as x(asset_id, amount_kobo);

  return v_run;
end;
$$;

-- Removes the asset's cost and accumulated depreciation from the books,
-- records cash received (if any), and plugs the difference to
-- disposal_gain_loss — debited for a loss, credited for a gain — so the
-- same formula handles both directions without a branch for which one
-- it is.
create or replace function public.dispose_fixed_asset(p_asset_id uuid, p_disposal_date date, p_proceeds_kobo bigint default 0)
returns public.fixed_assets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset public.fixed_assets;
  v_journal_entry_id uuid;
  v_diff bigint;
begin
  select * into v_asset from public.fixed_assets where id = p_asset_id for update;
  if v_asset.id is null then
    raise exception 'Fixed asset % not found', p_asset_id;
  end if;
  if v_asset.status <> 'active' then
    raise exception 'Fixed asset % is not active (status: %)', p_asset_id, v_asset.status;
  end if;
  if p_proceeds_kobo < 0 then
    raise exception 'Disposal proceeds cannot be negative';
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_asset.org_id, 'Disposal of fixed asset: ' || v_asset.name, p_disposal_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, v_asset.org_id, 'fixed_assets', 'credit', v_asset.cost_kobo);

  if v_asset.accumulated_depreciation_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'accumulated_depreciation', 'debit', v_asset.accumulated_depreciation_kobo);
  end if;

  if p_proceeds_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'cash_and_bank', 'debit', p_proceeds_kobo);
  end if;

  -- diff > 0: debits (accumulated depreciation removed + cash in) fall
  -- short of the credit (cost removed) -> a loss, debited to close it.
  -- diff < 0: debits exceed the credit -> a gain, credited to close it.
  v_diff := v_asset.cost_kobo - v_asset.accumulated_depreciation_kobo - p_proceeds_kobo;
  if v_diff > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'disposal_gain_loss', 'debit', v_diff);
  elsif v_diff < 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'disposal_gain_loss', 'credit', -v_diff);
  end if;

  update public.fixed_assets
  set status = 'disposed', disposed_at = p_disposal_date, disposal_proceeds_kobo = p_proceeds_kobo,
      disposal_journal_entry_id = v_journal_entry_id
  where id = p_asset_id
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.run_depreciation(uuid, date) from public;
revoke all on function public.dispose_fixed_asset(uuid, date, bigint) from public;
grant execute on function public.run_depreciation(uuid, date) to authenticated;
grant execute on function public.dispose_fixed_asset(uuid, date, bigint) to authenticated;

-- Four new system accounts the postings above rely on, seeded for every
-- org that already exists.
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, a.code, a.name, a.type, true
from public.organizations o
cross join (
  values
    ('fixed_assets', 'Fixed assets (cost)', 'asset'),
    ('accumulated_depreciation', 'Accumulated depreciation (contra-asset)', 'asset'),
    ('depreciation_expense', 'Depreciation expense', 'expense'),
    ('disposal_gain_loss', 'Gain/(loss) on disposal of fixed assets', 'revenue')
) as a(code, name, type)
on conflict (org_id, code) do nothing;

-- Atomic org bootstrap — replaced again to also seed the four new
-- accounts above, so a brand-new org's chart is complete from creation
-- rather than needing this migration's backfill insert to catch up later.
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

  insert into public.chart_of_accounts (org_id, code, name, type, is_system)
  values
    (v_org.id, 'payroll_expense', 'Payroll expense', 'expense', true),
    (v_org.id, 'expense_reimbursement_expense', 'Expense reimbursement expense', 'expense', true),
    (v_org.id, 'overtime_pay_expense', 'Overtime pay expense', 'expense', true),
    (v_org.id, 'thirteenth_month_expense', '13th month expense', 'expense', true),
    (v_org.id, 'bonus_expense', 'Bonus expense', 'expense', true),
    (v_org.id, 'arrears_expense', 'Arrears expense', 'expense', true),
    (v_org.id, 'employer_pension_expense', 'Employer pension expense', 'expense', true),
    (v_org.id, 'benefits_expense', 'Benefits expense', 'expense', true),
    (v_org.id, 'leave_payout_expense', 'Leave payout expense (final settlement)', 'expense', true),
    (v_org.id, 'gratuity_expense', 'Gratuity expense (final settlement)', 'expense', true),
    (v_org.id, 'nsitf_expense', 'NSITF expense', 'expense', true),
    (v_org.id, 'vendor_expense', 'Vendor expense', 'expense', true),
    (v_org.id, 'net_pay_payable', 'Net pay payable', 'liability', true),
    (v_org.id, 'paye_payable', 'PAYE payable (due FIRS/state IRS, before the 10th)', 'liability', true),
    (v_org.id, 'pension_payable', 'Pension payable (due PFA, before the 7th)', 'liability', true),
    (v_org.id, 'nhf_payable', 'NHF payable (due FMBN, before the 10th)', 'liability', true),
    (v_org.id, 'benefits_payable', 'Benefits payable', 'liability', true),
    (v_org.id, 'nsitf_payable', 'NSITF payable (due NSITF, before the 16th)', 'liability', true),
    (v_org.id, 'accounts_payable', 'Accounts payable', 'liability', true),
    (v_org.id, 'accounts_receivable', 'Accounts receivable', 'asset', true),
    (v_org.id, 'sales_revenue', 'Sales revenue', 'revenue', true),
    (v_org.id, 'fixed_assets', 'Fixed assets (cost)', 'asset', true),
    (v_org.id, 'accumulated_depreciation', 'Accumulated depreciation (contra-asset)', 'asset', true),
    (v_org.id, 'depreciation_expense', 'Depreciation expense', 'expense', true),
    (v_org.id, 'disposal_gain_loss', 'Gain/(loss) on disposal of fixed assets', 'revenue', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
