-- Chart of Accounts: turns the flat, hardcoded account_code -> label map
-- in apps/wagebook/src/lib/accounts.ts into a real, admin-manageable,
-- typed (asset/liability/equity/revenue/expense) table per org — the
-- natural next layer on the double-entry ledger payroll and accounts
-- payable already post to.
--
-- Deliberately NOT a foreign key from ledger_postings.account_code: every
-- existing posting path (create_pay_run, approve/pay_vendor_bill, final
-- settlement, and everything else that writes ledger_postings) computes
-- its account_code in TypeScript and has been doing so since before this
-- table existed. Adding a hard FK now would make every one of those
-- inserts start failing the moment a code and an org's chart drift even
-- slightly out of sync — for a live system already processing real pay
-- runs, that risk isn't worth what a stricter constraint buys today. The
-- chart is the authoritative, editable reference for what an account
-- means; the general ledger report below joins against it for display
-- and falls back to the raw code for anything not (yet) listed.
--
-- Idempotent throughout, matching 20260730010000: IF NOT EXISTS / DROP
-- POLICY IF EXISTS, since migrations here are applied by hand.
create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null check (char_length(name) > 0),
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  description text,
  -- Seeded accounts every existing posting path already relies on by
  -- name — the UI hides delete (not edit) for these, so accidentally
  -- removing one can't silently strand postings with a label-less code.
  is_system boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists chart_of_accounts_org_id_idx on public.chart_of_accounts (org_id);

alter table public.chart_of_accounts enable row level security;

drop policy if exists "admins, payroll managers and accountants can view chart of accounts" on public.chart_of_accounts;
create policy "admins, payroll managers and accountants can view chart of accounts"
on public.chart_of_accounts for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add accounts" on public.chart_of_accounts;
create policy "admins and payroll managers can add accounts"
on public.chart_of_accounts for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can update accounts" on public.chart_of_accounts;
create policy "admins and payroll managers can update accounts"
on public.chart_of_accounts for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- System accounts can't be deleted through this policy at all (not even
-- by an admin) — the `not is_system` check is enforced here, in the
-- policy itself, rather than only hidden in the UI.
drop policy if exists "admins and payroll managers can delete custom accounts" on public.chart_of_accounts;
create policy "admins and payroll managers can delete custom accounts"
on public.chart_of_accounts for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']) and not is_system);

-- Every account code any posting path in this codebase actually uses
-- today (see apps/wagebook/src/lib/accounts.ts), seeded for every org
-- that already exists so no existing pay run, settlement or vendor bill
-- ever posts to a code missing from its own chart.
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, a.code, a.name, a.type, true
from public.organizations o
cross join (
  values
    ('payroll_expense', 'Payroll expense', 'expense'),
    ('expense_reimbursement_expense', 'Expense reimbursement expense', 'expense'),
    ('overtime_pay_expense', 'Overtime pay expense', 'expense'),
    ('thirteenth_month_expense', '13th month expense', 'expense'),
    ('bonus_expense', 'Bonus expense', 'expense'),
    ('arrears_expense', 'Arrears expense', 'expense'),
    ('employer_pension_expense', 'Employer pension expense', 'expense'),
    ('benefits_expense', 'Benefits expense', 'expense'),
    ('leave_payout_expense', 'Leave payout expense (final settlement)', 'expense'),
    ('gratuity_expense', 'Gratuity expense (final settlement)', 'expense'),
    ('nsitf_expense', 'NSITF expense', 'expense'),
    ('vendor_expense', 'Vendor expense', 'expense'),
    ('net_pay_payable', 'Net pay payable', 'liability'),
    ('paye_payable', 'PAYE payable (due FIRS/state IRS, before the 10th)', 'liability'),
    ('pension_payable', 'Pension payable (due PFA, before the 7th)', 'liability'),
    ('nhf_payable', 'NHF payable (due FMBN, before the 10th)', 'liability'),
    ('benefits_payable', 'Benefits payable', 'liability'),
    ('nsitf_payable', 'NSITF payable (due NSITF, before the 16th)', 'liability'),
    ('accounts_payable', 'Accounts payable', 'liability'),
    ('staff_loans_receivable', 'Staff loans receivable', 'asset'),
    ('cash_and_bank', 'Cash and bank', 'asset')
) as a(code, name, type)
on conflict (org_id, code) do nothing;

-- Atomic org bootstrap already exists (create_organization) — replaced
-- here to also seed the same system accounts for a brand-new org, so
-- onboarding never produces an org with an empty, non-functional chart.
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
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
