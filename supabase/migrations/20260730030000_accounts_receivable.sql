-- Accounts Receivable v1 — the revenue-side mirror of Accounts Payable
-- (20260730010000). Customer invoices post real double-entry journal
-- entries the same way vendor bills do, on an accrual basis:
--
--   Issued -> debit accounts_receivable, credit a revenue account
--             (revenue is recognized when the invoice is issued to the
--             customer, not when cash is actually collected)
--   Paid   -> debit cash_and_bank, credit accounts_receivable
--             (settling the receivable, modelling the actual cash inflow
--             — the mirror image of pay_vendor_bill's cash outflow)
--
-- A draft invoice hasn't posted anything yet and can be voided for free;
-- once issued, the posting has already recognized revenue, so — like an
-- approved vendor bill — there's no "unissue," only paying it or leaving
-- it outstanding. Not built here: credit notes, partial payments,
-- recurring/subscription invoices, multi-currency, aging reports — this
-- is the draft/issue/pay lifecycle and the ledger integration, disclosed
-- honestly on the feature map.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS), matching
-- every migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor, so a half-applied or repeated run
-- must be safe to redo from the top.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  contact_email text,
  contact_phone text,
  billing_address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index if not exists customers_org_id_idx on public.customers (org_id);

create table if not exists public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  invoice_number text,
  invoice_date date not null,
  due_date date,
  amount_kobo bigint not null check (amount_kobo > 0),
  description text not null check (char_length(description) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'void')),
  created_by uuid not null references auth.users (id),
  issued_by uuid references auth.users (id),
  issued_at timestamptz,
  paid_at timestamptz,
  journal_entry_id uuid references public.journal_entries (id) on delete set null,
  payment_journal_entry_id uuid references public.journal_entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_invoices_org_id_idx on public.customer_invoices (org_id);
create index if not exists customer_invoices_customer_id_idx on public.customer_invoices (customer_id);
create index if not exists customer_invoices_status_idx on public.customer_invoices (status);

alter table public.customers enable row level security;
alter table public.customer_invoices enable row level security;

drop policy if exists "admins, payroll managers and accountants can view customers" on public.customers;
create policy "admins, payroll managers and accountants can view customers"
on public.customers for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add customers" on public.customers;
create policy "admins and payroll managers can add customers"
on public.customers for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can update customers" on public.customers;
create policy "admins and payroll managers can update customers"
on public.customers for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can delete customers" on public.customers;
create policy "admins and payroll managers can delete customers"
on public.customers for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view customer invoices" on public.customer_invoices;
create policy "admins, payroll managers and accountants can view customer invoices"
on public.customer_invoices for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add customer invoices" on public.customer_invoices;
create policy "admins and payroll managers can add customer invoices"
on public.customer_invoices for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Only the issue/void/receive-payment functions below actually update an
-- invoice — this policy exists because they run security invoker (as the
-- calling user, through normal RLS) rather than security definer, so they
-- need something to satisfy. No client ever updates customer_invoices
-- directly, matching the vendor_bills convention.
drop policy if exists "admins and payroll managers can update customer invoices" on public.customer_invoices;
create policy "admins and payroll managers can update customer invoices"
on public.customer_invoices for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Atomic issue: recognizes revenue. security invoker (like
-- approve_vendor_bill) — every insert still goes through the RLS
-- policies above for whoever calls it; this function grants no privilege
-- beyond what the caller's role already has.
create or replace function public.issue_customer_invoice(p_invoice_id uuid, p_revenue_account_code text default 'sales_revenue')
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
  v_journal_entry_id uuid;
begin
  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;

  if v_invoice.id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Invoice % is not a draft (status: %)', p_invoice_id, v_invoice.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_invoice.org_id, 'Customer invoice issued: ' || v_invoice.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_invoice.org_id, 'accounts_receivable', 'debit', v_invoice.amount_kobo),
    (v_journal_entry_id, v_invoice.org_id, p_revenue_account_code, 'credit', v_invoice.amount_kobo);

  update public.customer_invoices
  set status = 'issued', issued_by = auth.uid(), issued_at = now(), journal_entry_id = v_journal_entry_id
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

create or replace function public.void_customer_invoice(p_invoice_id uuid)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
begin
  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;

  if v_invoice.id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Invoice % is not a draft (status: %)', p_invoice_id, v_invoice.status;
  end if;

  update public.customer_invoices
  set status = 'void', issued_by = auth.uid(), issued_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

-- Atomic payment: settles the receivable against cash — the mirror of
-- pay_vendor_bill's cash outflow, this time a cash inflow.
create or replace function public.receive_customer_payment(p_invoice_id uuid)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
  v_journal_entry_id uuid;
begin
  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;

  if v_invoice.id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if v_invoice.status <> 'issued' then
    raise exception 'Invoice % is not issued (status: %)', p_invoice_id, v_invoice.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_invoice.org_id, 'Customer invoice paid: ' || v_invoice.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_invoice.org_id, 'cash_and_bank', 'debit', v_invoice.amount_kobo),
    (v_journal_entry_id, v_invoice.org_id, 'accounts_receivable', 'credit', v_invoice.amount_kobo);

  update public.customer_invoices
  set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
  where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.issue_customer_invoice(uuid, text) from public;
revoke all on function public.void_customer_invoice(uuid) from public;
revoke all on function public.receive_customer_payment(uuid) from public;
grant execute on function public.issue_customer_invoice(uuid, text) to authenticated;
grant execute on function public.void_customer_invoice(uuid) to authenticated;
grant execute on function public.receive_customer_payment(uuid) to authenticated;

-- Two new system accounts the postings above rely on, seeded for every
-- org that already exists (the chart of accounts seed in 20260730020000
-- predates invoicing, so accounts_receivable and sales_revenue weren't in
-- it yet).
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, a.code, a.name, a.type, true
from public.organizations o
cross join (
  values
    ('accounts_receivable', 'Accounts receivable', 'asset'),
    ('sales_revenue', 'Sales revenue', 'revenue')
) as a(code, name, type)
on conflict (org_id, code) do nothing;

-- Atomic org bootstrap — replaced again to also seed the two new
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
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
