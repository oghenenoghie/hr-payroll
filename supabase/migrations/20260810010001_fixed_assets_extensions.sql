-- Fixed Assets extensions: declining-balance depreciation, mid-month
-- proration, asset transfers between cost centres, and revaluation —
-- the four items 20260730050000_fixed_assets.sql explicitly disclosed as
-- not built. Impairment and modelling how an asset was financed at
-- acquisition remain out of scope, still disclosed on the feature map.
--
-- Every new column defaults so that an asset created before this
-- migration behaves byte-identically to before: depreciation_method
-- defaults to 'straight_line', revaluation_adjustment_kobo defaults to
-- 0, department_id defaults to null. run_depreciation's formula for a
-- straight-line asset owned the whole period is unchanged arithmetic
-- (still (cost - salvage) / useful_life_months, no rounding change) —
-- proration only kicks in for an asset acquired inside the run's own
-- period, which was structurally impossible to express before this
-- migration added period_start to depreciation_runs.
alter table public.fixed_assets
  add column if not exists depreciation_method text not null default 'straight_line'
    check (depreciation_method in ('straight_line', 'declining_balance')),
  add column if not exists declining_balance_rate_percent integer
    check (declining_balance_rate_percent is null or declining_balance_rate_percent between 1 and 100),
  add column if not exists department_id uuid references public.departments (id) on delete set null,
  add column if not exists revaluation_adjustment_kobo bigint not null default 0;

alter table public.fixed_assets
  add constraint fixed_assets_declining_balance_rate_required
  check (depreciation_method != 'declining_balance' or declining_balance_rate_percent is not null);

create index if not exists fixed_assets_department_id_idx on public.fixed_assets (department_id);

-- period_start didn't exist before — every prior run only ever depreciated
-- a full nominal period for every eligible asset, so there was nothing to
-- prorate against. Backfilled to the first of period_end's month purely
-- so existing rows display a sensible range; it plays no role in any
-- already-posted journal entry, which is never recomputed.
alter table public.depreciation_runs add column if not exists period_start date;
update public.depreciation_runs set period_start = date_trunc('month', period_end)::date where period_start is null;
alter table public.depreciation_runs alter column period_start set not null;
alter table public.depreciation_runs add constraint depreciation_runs_period_check check (period_end >= period_start);

-- Kept record, same shape as employee_relations_case_notes/
-- training_quiz_attempts — no update/delete policy for anyone. Read
-- access matches fixed_assets' own SELECT roles exactly; write matches
-- fixed_assets' own admin/payroll_manager write roles, since a transfer
-- or revaluation is exactly as sensitive as editing the asset itself.
create table public.asset_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  asset_id uuid not null references public.fixed_assets (id) on delete cascade,
  from_department_id uuid references public.departments (id) on delete set null,
  to_department_id uuid references public.departments (id) on delete set null,
  transferred_by uuid not null references auth.users (id),
  transferred_at timestamptz not null default now(),
  note text
);

create index asset_transfers_org_id_idx on public.asset_transfers (org_id);
create index asset_transfers_asset_id_idx on public.asset_transfers (asset_id);

alter table public.asset_transfers enable row level security;

create policy "admins, payroll managers and accountants can view asset transfers"
on public.asset_transfers for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "auditors can view asset transfers"
on public.asset_transfers for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "finance managers can view asset transfers"
on public.asset_transfers for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "admins and payroll managers can record asset transfers"
on public.asset_transfers for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create table public.asset_revaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  asset_id uuid not null references public.fixed_assets (id) on delete cascade,
  adjustment_kobo bigint not null check (adjustment_kobo != 0),
  note text,
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  revalued_by uuid not null references auth.users (id),
  revalued_at timestamptz not null default now()
);

create index asset_revaluations_org_id_idx on public.asset_revaluations (org_id);
create index asset_revaluations_asset_id_idx on public.asset_revaluations (asset_id);

alter table public.asset_revaluations enable row level security;

create policy "admins, payroll managers and accountants can view asset revaluations"
on public.asset_revaluations for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "auditors can view asset revaluations"
on public.asset_revaluations for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "finance managers can view asset revaluations"
on public.asset_revaluations for select
to authenticated
using (core.has_org_role(org_id, array['finance_manager']));

create policy "admins and payroll managers can record asset revaluations"
on public.asset_revaluations for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- One new system account, seeded for every existing org and folded into
-- create_organization() for new ones, same two-step pattern
-- 20260730050000_fixed_assets.sql already established for its own four
-- accounts.
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, 'revaluation_surplus', 'Revaluation surplus (fixed assets)', 'equity', true
from public.organizations o
on conflict (org_id, code) do nothing;

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
    (v_org.id, 'bank_fees_expense', 'Bank fees expense', 'expense', true),
    (v_org.id, 'bank_interest_income', 'Bank interest income', 'revenue', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true),
    (v_org.id, 'revaluation_surplus', 'Revaluation surplus (fixed assets)', 'equity', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;

-- Signature changed (period_start added) — drop the old two-arg version
-- rather than leaving it as an orphaned overload alongside the new one.
drop function if exists public.run_depreciation(uuid, date);

-- Straight-line: for an asset owned the whole period (acquired on or
-- before period_start), the nominal amount is the exact same integer
-- division as before — no proration math touches that case at all.
-- Only an asset acquired inside [period_start, period_end] gets its
-- nominal amount scaled by the days it was actually owned within the
-- period. Declining-balance is new so there's no prior behavior to
-- preserve: it's always rate x book-value x (period days / 365), which
-- prorates for free by construction. Both methods reuse the same
-- "cap at remaining depreciable amount" guard the original function had,
-- now against a depreciable base that accounts for any revaluation
-- adjustment (0 for an asset that's never been revalued, so no change
-- there either).
create or replace function public.run_depreciation(p_org_id uuid, p_period_start date, p_period_end date)
returns public.depreciation_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset record;
  v_amount bigint;
  v_nominal bigint;
  v_total bigint := 0;
  v_journal_entry_id uuid;
  v_run public.depreciation_runs;
  v_asset_ids uuid[] := '{}';
  v_amounts bigint[] := '{}';
  v_period_days int;
  v_owned_days int;
  v_book_value bigint;
  v_depreciable_base bigint;
begin
  if p_period_end < p_period_start then
    raise exception 'Period end cannot be before period start';
  end if;

  v_period_days := (p_period_end - p_period_start) + 1;

  for v_asset in
    select * from public.fixed_assets
    where org_id = p_org_id and status = 'active'
      and acquisition_date <= p_period_end
      and accumulated_depreciation_kobo < (cost_kobo + revaluation_adjustment_kobo - salvage_value_kobo)
    order by acquisition_date
  loop
    v_depreciable_base := v_asset.cost_kobo + v_asset.revaluation_adjustment_kobo - v_asset.salvage_value_kobo;

    if v_asset.depreciation_method = 'declining_balance' then
      v_book_value := v_asset.cost_kobo + v_asset.revaluation_adjustment_kobo - v_asset.accumulated_depreciation_kobo;
      v_nominal := round(v_book_value * v_asset.declining_balance_rate_percent::numeric / 100 * v_period_days / 365.0);
    else
      v_nominal := v_depreciable_base / v_asset.useful_life_months;
      if v_asset.acquisition_date > p_period_start then
        v_owned_days := (p_period_end - v_asset.acquisition_date) + 1;
        v_nominal := round(v_nominal * v_owned_days::numeric / v_period_days);
      end if;
    end if;

    v_amount := least(v_nominal, v_depreciable_base - v_asset.accumulated_depreciation_kobo);

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

  insert into public.journal_entries (org_id, memo, entry_date)
  values (p_org_id, 'Depreciation for period ' || p_period_start || ' to ' || p_period_end, p_period_end)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, p_org_id, 'depreciation_expense', 'debit', v_total),
    (v_journal_entry_id, p_org_id, 'accumulated_depreciation', 'credit', v_total);

  insert into public.depreciation_runs (org_id, period_start, period_end, total_amount_kobo, journal_entry_id, created_by)
  values (p_org_id, p_period_start, p_period_end, v_total, v_journal_entry_id, auth.uid())
  returning * into v_run;

  insert into public.depreciation_lines (depreciation_run_id, asset_id, amount_kobo)
  select v_run.id, x.asset_id, x.amount_kobo from unnest(v_asset_ids, v_amounts) as x(asset_id, amount_kobo);

  return v_run;
end;
$$;

revoke all on function public.run_depreciation(uuid, date, date) from public;
grant execute on function public.run_depreciation(uuid, date, date) to authenticated;

-- Republished so the book-value formula (and therefore the gain/loss on
-- disposal) accounts for revaluation_adjustment_kobo — 0 for any asset
-- that's never been revalued, so this is byte-identical to the original
-- for every pre-existing asset. Any revaluation surplus still on the
-- books for the asset is deliberately left alone rather than swept to
-- retained earnings on disposal — this build has no period-close step
-- that would do that sweep for the computed retained-earnings line on
-- the Balance Sheet either, so it's the same disclosed simplification,
-- not a new one.
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
  v_adjusted_cost bigint;
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

  v_adjusted_cost := v_asset.cost_kobo + v_asset.revaluation_adjustment_kobo;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_asset.org_id, 'Disposal of fixed asset: ' || v_asset.name, p_disposal_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, v_asset.org_id, 'fixed_assets', 'credit', v_adjusted_cost);

  if v_asset.accumulated_depreciation_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'accumulated_depreciation', 'debit', v_asset.accumulated_depreciation_kobo);
  end if;

  if p_proceeds_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_asset.org_id, 'cash_and_bank', 'debit', p_proceeds_kobo);
  end if;

  v_diff := v_adjusted_cost - v_asset.accumulated_depreciation_kobo - p_proceeds_kobo;
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

revoke all on function public.dispose_fixed_asset(uuid, date, bigint) from public;
grant execute on function public.dispose_fixed_asset(uuid, date, bigint) to authenticated;

-- No ledger posting — a transfer is a pure cost-centre reassignment, the
-- same "no dollar value changes" shape as moving an employee between
-- departments. Security invoker, same as every other write in this
-- module: relies on the caller's own RLS (the insert policy on
-- asset_transfers above, plus the existing admin/payroll_manager update
-- policy on fixed_assets itself), not a definer bypass.
create or replace function public.transfer_fixed_asset(p_asset_id uuid, p_to_department_id uuid, p_note text default null)
returns public.fixed_assets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset public.fixed_assets;
begin
  select * into v_asset from public.fixed_assets where id = p_asset_id for update;
  if v_asset.id is null then
    raise exception 'Fixed asset % not found', p_asset_id;
  end if;
  if v_asset.status <> 'active' then
    raise exception 'Fixed asset % is not active (status: %)', p_asset_id, v_asset.status;
  end if;

  insert into public.asset_transfers (org_id, asset_id, from_department_id, to_department_id, transferred_by, note)
  values (v_asset.org_id, v_asset.id, v_asset.department_id, p_to_department_id, auth.uid(), p_note);

  update public.fixed_assets
  set department_id = p_to_department_id
  where id = p_asset_id
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.transfer_fixed_asset(uuid, uuid, text) from public;
grant execute on function public.transfer_fixed_asset(uuid, uuid, text) to authenticated;

-- Upward revaluation debits fixed_assets and credits revaluation_surplus
-- (an equity reserve); downward reverses both sides. Deliberately not
-- the full revaluation-model nuance of recognizing a downward
-- adjustment through profit/loss once it exceeds any surplus already
-- recorded for that specific asset — every adjustment here posts
-- symmetrically against revaluation_surplus regardless of direction or
-- prior balance, a disclosed simplification.
create or replace function public.revalue_fixed_asset(
  p_asset_id uuid,
  p_adjustment_kobo bigint,
  p_revaluation_date date,
  p_note text default null
)
returns public.fixed_assets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset public.fixed_assets;
  v_journal_entry_id uuid;
  v_new_adjusted_cost bigint;
begin
  select * into v_asset from public.fixed_assets where id = p_asset_id for update;
  if v_asset.id is null then
    raise exception 'Fixed asset % not found', p_asset_id;
  end if;
  if v_asset.status <> 'active' then
    raise exception 'Fixed asset % is not active (status: %)', p_asset_id, v_asset.status;
  end if;
  if p_adjustment_kobo = 0 then
    raise exception 'Enter a non-zero revaluation adjustment';
  end if;

  v_new_adjusted_cost := v_asset.cost_kobo + v_asset.revaluation_adjustment_kobo + p_adjustment_kobo;
  if v_new_adjusted_cost <= v_asset.accumulated_depreciation_kobo then
    raise exception 'This adjustment would take the asset''s book value to zero or below';
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (
    v_asset.org_id,
    (case when p_adjustment_kobo > 0 then 'Upward revaluation of ' else 'Downward revaluation of ' end) || v_asset.name,
    p_revaluation_date
  )
  returning id into v_journal_entry_id;

  if p_adjustment_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, v_asset.org_id, 'fixed_assets', 'debit', p_adjustment_kobo),
      (v_journal_entry_id, v_asset.org_id, 'revaluation_surplus', 'credit', p_adjustment_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, v_asset.org_id, 'revaluation_surplus', 'debit', -p_adjustment_kobo),
      (v_journal_entry_id, v_asset.org_id, 'fixed_assets', 'credit', -p_adjustment_kobo);
  end if;

  insert into public.asset_revaluations (org_id, asset_id, adjustment_kobo, note, journal_entry_id, revalued_by)
  values (v_asset.org_id, v_asset.id, p_adjustment_kobo, p_note, v_journal_entry_id, auth.uid());

  update public.fixed_assets
  set revaluation_adjustment_kobo = revaluation_adjustment_kobo + p_adjustment_kobo
  where id = p_asset_id
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.revalue_fixed_asset(uuid, bigint, date, text) from public;
grant execute on function public.revalue_fixed_asset(uuid, bigint, date, text) to authenticated;
