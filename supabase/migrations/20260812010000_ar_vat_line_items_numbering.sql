-- Accounts Receivable gets the same VAT treatment Accounts Payable got in
-- 20260811010000: customer_invoices gains a subtotal/VAT breakdown computed
-- from packages/compliance's computeVat (the same categorical rate table
-- vendor bills already use), rather than reintroducing an org-level flat
-- VAT rate. amount_kobo keeps its existing meaning (VAT-inclusive total),
-- matching vendor_bills' own subtotal_kobo/vat_kobo convention exactly, so
-- every existing read of amount_kobo (CSV export, aging report, the
-- general ledger postings) keeps meaning exactly what it already means.
--
-- Deliberately NOT mirrored from vendor_bills: wht_category/wht_kobo/
-- net_payable_kobo. Withholding tax on money a customer pays *this* org
-- is a distinct, largely inactive concept in Nigerian practice compared to
-- WHT this org withholds when paying a vendor — modelling it would need
-- its own rate table and remittance logic that packages/compliance
-- doesn't have yet. Disclosed gap, not an oversight: AR VAT ships now, AR
-- WHT doesn't.
--
-- Both customer_invoices and vendor_bills also gain real line items
-- (customer_invoice_lines / vendor_bill_lines) — until now every invoice
-- and bill was a single opaque amount with a text description. Lines are
-- deliberately dumb storage (description, quantity, unit price, discount,
-- computed total) with no VAT/WHT logic of their own: rate computation
-- stays exactly where 20260811010000 already put it (TypeScript, against
-- a subtotal), so a line's job is only to substantiate that subtotal.
--
-- And both gain real auto-numbering (INV-2026-000001 / BILL-2026-000001),
-- replacing the free-text, often-empty invoice_number/bill_number columns.
-- document_number_counters is a per-org-per-doc-type-per-year sequence,
-- incremented atomically via INSERT ... ON CONFLICT ... DO UPDATE ...
-- RETURNING (race-safe under concurrent inserts, same pattern this
-- codebase already uses elsewhere for atomic counters) inside a SECURITY
-- DEFINER function — the counters table itself carries no RLS policies at
-- all (RLS is enabled with zero grants), so it's reachable only through
-- that function's table-owner privilege bypass, the same shape as
-- create_organization's own SECURITY DEFINER precedent. Existing rows
-- with a null or blank number get backfilled the same way; going forward
-- a before-insert trigger assigns one only when the row doesn't already
-- carry one, so nothing here forces a renumber of a manually-set value.
--
-- Known limitation, disclosed rather than guarded against: a handful of
-- pre-existing rows could in principle already share a hand-typed
-- invoice_number/bill_number before this migration made the column
-- unique per org — this codebase has no live data to have hit that in
-- practice, and adding real de-duplication logic for a scenario nothing
-- indicates has occurred would be speculative engineering.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS / DROP
-- TRIGGER IF EXISTS / CREATE OR REPLACE / a pg_constraint existence guard
-- around the one CHECK constraint, since ADD CONSTRAINT has no IF NOT
-- EXISTS of its own), matching every migration since 20260730010000:
-- this project's operator
-- applies migrations by hand in the SQL Editor.

-- === 1. customer_invoices: VAT breakdown, mirroring vendor_bills ===

alter table public.customer_invoices
  add column if not exists subtotal_kobo bigint check (subtotal_kobo >= 0),
  add column if not exists vat_category text,
  add column if not exists vat_kobo bigint not null default 0 check (vat_kobo >= 0),
  add column if not exists vat_exempt boolean not null default false,
  add column if not exists rule_version_id text;

update public.customer_invoices
set subtotal_kobo = amount_kobo - coalesce(vat_kobo, 0)
where subtotal_kobo is null;

alter table public.customer_invoices
  alter column subtotal_kobo set not null;

-- Postgres has no "ADD CONSTRAINT IF NOT EXISTS" for a CHECK constraint
-- (unlike ADD COLUMN) — guarded manually via pg_constraint instead, same
-- idempotency goal as everywhere else in this migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_invoices_amount_equals_subtotal_plus_vat'
  ) then
    alter table public.customer_invoices
      add constraint customer_invoices_amount_equals_subtotal_plus_vat
      check (amount_kobo = subtotal_kobo + vat_kobo);
  end if;
end $$;

-- === 2. Line items — dumb storage, no VAT/WHT logic of their own ===

create table if not exists public.customer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices (id) on delete cascade,
  description text not null check (char_length(description) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  line_total_kobo bigint not null check (line_total_kobo >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists customer_invoice_lines_org_id_idx on public.customer_invoice_lines (org_id);
create index if not exists customer_invoice_lines_invoice_id_idx on public.customer_invoice_lines (invoice_id);

create table if not exists public.vendor_bill_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  bill_id uuid not null references public.vendor_bills (id) on delete cascade,
  description text not null check (char_length(description) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  line_total_kobo bigint not null check (line_total_kobo >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists vendor_bill_lines_org_id_idx on public.vendor_bill_lines (org_id);
create index if not exists vendor_bill_lines_bill_id_idx on public.vendor_bill_lines (bill_id);

alter table public.customer_invoice_lines enable row level security;
alter table public.vendor_bill_lines enable row level security;

-- Both new tables are only ever written by the atomic create-with-lines
-- functions below (security invoker, so every insert still goes through
-- these same policies for whoever calls them) — no client inserts either
-- table directly, matching the customer_invoice_payments/credit_notes
-- convention of "an insert policy that exists only to satisfy the atomic
-- function". Select includes auditor directly (rather than as a separate
-- additive policy) since these tables postdate the Auditor rollout.
drop policy if exists "admins, payroll managers, accountants and auditors can view invoice lines" on public.customer_invoice_lines;
create policy "admins, payroll managers, accountants and auditors can view invoice lines"
on public.customer_invoice_lines for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant', 'auditor']));

drop policy if exists "admins and payroll managers can add invoice lines" on public.customer_invoice_lines;
create policy "admins and payroll managers can add invoice lines"
on public.customer_invoice_lines for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers, accountants and auditors can view bill lines" on public.vendor_bill_lines;
create policy "admins, payroll managers, accountants and auditors can view bill lines"
on public.vendor_bill_lines for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant', 'auditor']));

drop policy if exists "admins and payroll managers can add bill lines" on public.vendor_bill_lines;
create policy "admins and payroll managers can add bill lines"
on public.vendor_bill_lines for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- === 3. Auto-numbering ===

create table if not exists public.document_number_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null check (doc_type in ('invoice', 'bill')),
  year int not null,
  last_number int not null default 0,
  primary key (org_id, doc_type, year)
);

-- No policies at all — this table is never read or written directly by a
-- client, only through generate_document_number()'s SECURITY DEFINER
-- table-owner bypass below, the same shape create_organization uses for
-- organizations/org_memberships/chart_of_accounts.
alter table public.document_number_counters enable row level security;

create or replace function public.generate_document_number(p_org_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_number int;
  v_prefix text;
begin
  v_prefix := case p_doc_type
    when 'invoice' then 'INV'
    when 'bill' then 'BILL'
    else null
  end;
  if v_prefix is null then
    raise exception 'Unknown document type: %', p_doc_type;
  end if;

  insert into public.document_number_counters (org_id, doc_type, year, last_number)
  values (p_org_id, p_doc_type, v_year, 1)
  on conflict (org_id, doc_type, year)
  do update set last_number = public.document_number_counters.last_number + 1
  returning last_number into v_number;

  return v_prefix || '-' || v_year || '-' || lpad(v_number::text, 6, '0');
end;
$$;

revoke all on function public.generate_document_number(uuid, text) from public;
grant execute on function public.generate_document_number(uuid, text) to authenticated;

-- customer_invoices also defensively backfills subtotal_kobo when it's
-- null, keeping core.generate_recurring_customer_invoices (which only
-- ever sets amount_kobo, unchanged by this migration) working without
-- needing its own redeclare — vendor_bills needs no equivalent backfill
-- since 20260811010000 already made its subtotal_kobo NOT NULL and both
-- of its insert paths already set it.
create or replace function public.set_customer_invoice_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.invoice_number is null then
    new.invoice_number := public.generate_document_number(new.org_id, 'invoice');
  end if;
  if new.subtotal_kobo is null then
    new.subtotal_kobo := new.amount_kobo - coalesce(new.vat_kobo, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists customer_invoices_set_invoice_number_trigger on public.customer_invoices;
create trigger customer_invoices_set_invoice_number_trigger
before insert on public.customer_invoices
for each row
execute function public.set_customer_invoice_number();

create or replace function public.set_vendor_bill_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.bill_number is null then
    new.bill_number := public.generate_document_number(new.org_id, 'bill');
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_bills_set_bill_number_trigger on public.vendor_bills;
create trigger vendor_bills_set_bill_number_trigger
before insert on public.vendor_bills
for each row
execute function public.set_vendor_bill_number();

update public.customer_invoices
set invoice_number = public.generate_document_number(org_id, 'invoice')
where invoice_number is null or char_length(trim(invoice_number)) = 0;

update public.vendor_bills
set bill_number = public.generate_document_number(org_id, 'bill')
where bill_number is null or char_length(trim(bill_number)) = 0;

alter table public.customer_invoices
  alter column invoice_number set not null;

alter table public.vendor_bills
  alter column bill_number set not null;

create unique index if not exists customer_invoices_org_id_invoice_number_key
  on public.customer_invoices (org_id, invoice_number);

create unique index if not exists vendor_bills_org_id_bill_number_key
  on public.vendor_bills (org_id, bill_number);

-- === 4. Atomic create-with-lines: header + lines in one transaction ===

-- security invoker (like approve_vendor_bill / issue_customer_invoice):
-- every insert still goes through the RLS policies above for whoever
-- calls it — this grants no privilege beyond what the caller's role
-- already has. VAT is passed in already computed (TypeScript, against
-- packages/compliance's NG_2026_1 rule version, matching how BillForm
-- already works) — the only thing computed here in SQL is a sanity check
-- that the line items actually sum to the subtotal being posted, a
-- defense against a client-side bug rather than a security boundary
-- (20260811010000's createVendorBill doesn't re-verify at this level
-- either, since the real rate computation already happened in
-- @plutus/compliance before either code path ever reaches the database).
create or replace function public.create_customer_invoice_with_lines(
  p_customer_id uuid,
  p_description text,
  p_invoice_date date,
  p_due_date date,
  p_subtotal_kobo bigint,
  p_vat_category text,
  p_vat_kobo bigint,
  p_vat_exempt boolean,
  p_rule_version_id text,
  p_lines jsonb
)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_invoice public.customer_invoices;
  v_lines_subtotal bigint;
  v_line jsonb;
  v_sort_order int := 0;
begin
  select org_id into v_org_id from public.customers where id = p_customer_id;
  if v_org_id is null then
    raise exception 'Customer % not found', p_customer_id;
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'An invoice needs at least one line item';
  end if;

  select coalesce(sum((line ->> 'line_total_kobo')::bigint), 0) into v_lines_subtotal
  from jsonb_array_elements(p_lines) as line;

  if v_lines_subtotal <> p_subtotal_kobo then
    raise exception 'Line items total % does not match subtotal %', v_lines_subtotal, p_subtotal_kobo;
  end if;

  insert into public.customer_invoices (
    org_id, customer_id, description, invoice_date, due_date,
    amount_kobo, subtotal_kobo, vat_category, vat_kobo, vat_exempt, rule_version_id,
    status, created_by
  )
  values (
    v_org_id, p_customer_id, p_description, p_invoice_date, p_due_date,
    p_subtotal_kobo + p_vat_kobo, p_subtotal_kobo, p_vat_category, p_vat_kobo, p_vat_exempt, p_rule_version_id,
    'draft', auth.uid()
  )
  returning * into v_invoice;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort_order := v_sort_order + 1;
    insert into public.customer_invoice_lines (
      org_id, invoice_id, description, quantity, unit_price_kobo, discount_kobo, line_total_kobo, sort_order
    )
    values (
      v_org_id, v_invoice.id,
      v_line ->> 'description',
      (v_line ->> 'quantity')::numeric,
      (v_line ->> 'unit_price_kobo')::bigint,
      coalesce((v_line ->> 'discount_kobo')::bigint, 0),
      (v_line ->> 'line_total_kobo')::bigint,
      v_sort_order
    );
  end loop;

  return v_invoice;
end;
$$;

revoke all on function public.create_customer_invoice_with_lines(uuid, text, date, date, bigint, text, bigint, boolean, text, jsonb) from public;
grant execute on function public.create_customer_invoice_with_lines(uuid, text, date, date, bigint, text, bigint, boolean, text, jsonb) to authenticated;

create or replace function public.create_vendor_bill_with_lines(
  p_vendor_id uuid,
  p_description text,
  p_bill_date date,
  p_due_date date,
  p_subtotal_kobo bigint,
  p_vat_category text,
  p_vat_kobo bigint,
  p_vat_exempt boolean,
  p_wht_category text,
  p_wht_kobo bigint,
  p_rule_version_id text,
  p_lines jsonb
)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_bill public.vendor_bills;
  v_lines_subtotal bigint;
  v_line jsonb;
  v_sort_order int := 0;
  v_amount_kobo bigint;
  v_net_payable_kobo bigint;
begin
  select org_id into v_org_id from public.vendors where id = p_vendor_id;
  if v_org_id is null then
    raise exception 'Vendor % not found', p_vendor_id;
  end if;

  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'A bill needs at least one line item';
  end if;

  select coalesce(sum((line ->> 'line_total_kobo')::bigint), 0) into v_lines_subtotal
  from jsonb_array_elements(p_lines) as line;

  if v_lines_subtotal <> p_subtotal_kobo then
    raise exception 'Line items total % does not match subtotal %', v_lines_subtotal, p_subtotal_kobo;
  end if;

  v_amount_kobo := p_subtotal_kobo + p_vat_kobo;
  v_net_payable_kobo := v_amount_kobo - p_wht_kobo;

  insert into public.vendor_bills (
    org_id, vendor_id, description, bill_date, due_date,
    amount_kobo, subtotal_kobo, vat_category, vat_kobo, vat_exempt,
    wht_category, wht_kobo, net_payable_kobo, rule_version_id,
    status, requested_by
  )
  values (
    v_org_id, p_vendor_id, p_description, p_bill_date, p_due_date,
    v_amount_kobo, p_subtotal_kobo, p_vat_category, p_vat_kobo, p_vat_exempt,
    p_wht_category, p_wht_kobo, v_net_payable_kobo, p_rule_version_id,
    'pending_approval', auth.uid()
  )
  returning * into v_bill;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort_order := v_sort_order + 1;
    insert into public.vendor_bill_lines (
      org_id, bill_id, description, quantity, unit_price_kobo, discount_kobo, line_total_kobo, sort_order
    )
    values (
      v_org_id, v_bill.id,
      v_line ->> 'description',
      (v_line ->> 'quantity')::numeric,
      (v_line ->> 'unit_price_kobo')::bigint,
      coalesce((v_line ->> 'discount_kobo')::bigint, 0),
      (v_line ->> 'line_total_kobo')::bigint,
      v_sort_order
    );
  end loop;

  return v_bill;
end;
$$;

revoke all on function public.create_vendor_bill_with_lines(uuid, text, date, date, bigint, text, bigint, boolean, text, bigint, text, jsonb) from public;
grant execute on function public.create_vendor_bill_with_lines(uuid, text, date, date, bigint, text, bigint, boolean, text, bigint, text, jsonb) to authenticated;
