-- Module interconnectivity for Accounts Receivable/Payable: VAT, itemized
-- line items, and auto-numbered invoices/bills. Previously an invoice or
-- bill was a single flat amount_kobo + description with no line detail
-- and no tax, and invoice_number/bill_number were nullable free-text
-- fields nobody was required to fill in.
--
-- amount_kobo keeps its existing meaning (the grand total) so every
-- existing reader — issue_customer_invoice/approve_vendor_bill's ledger
-- postings, receive_customer_payment's outstanding-balance math, the
-- aging report, the vendor statement, every CSV export — needs zero
-- changes. subtotal_kobo and vat_kobo are additive: a breakdown of the
-- same total, not a new source of truth for it.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR
-- REPLACE), matching every migration since 20260730010000: this project's
-- operator applies migrations by hand in the SQL Editor, so a
-- half-applied or repeated run must be safe to redo from the top.

-- 1. VAT rate: a single org-wide configured rate, not per-customer/vendor
-- and not hardcoded into calculation code. Scaled the same way every rate
-- in packages/compliance is (parts-per-million — see money.ts's
-- RATE_SCALE), so applyRate()'s existing half-up-rounding logic works on
-- it unchanged. Default 75000 = 7.5%, the current Nigerian VAT rate — an
-- org can change it (or set it to 0) from the Invoices/Bills page.
alter table public.organizations
  add column if not exists vat_rate_scaled bigint not null default 75000;

-- 2. Line items — a genuinely new concept. Each row is one line on an
-- invoice or bill; line_total_kobo is always server-computed (quantity *
-- unit_price_kobo - discount_kobo), never taken from the client, by the
-- functions in the companion migration.
create table if not exists public.customer_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices (id) on delete cascade,
  description text not null check (char_length(description) > 0),
  quantity numeric not null check (quantity > 0),
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
  quantity numeric not null check (quantity > 0),
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

-- Same read scope as the parent table (original AP/AR migrations' select
-- policy plus auditor's later additive grant, combined here since this
-- table has no pre-auditor history to stay additive against).
drop policy if exists "admins, payroll managers, accountants and auditors can view invoice lines" on public.customer_invoice_lines;
create policy "admins, payroll managers, accountants and auditors can view invoice lines"
on public.customer_invoice_lines for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant', 'auditor']));

-- Insert-only: like customer_invoices/vendor_bills, nothing in this app
-- ever edits a line after creation — the create_*_with_lines functions
-- below are security invoker, so the calling admin/payroll_manager needs
-- this directly.
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

-- 3. Subtotal/VAT breakdown on the header rows, backfilled from the
-- existing amount_kobo (treated as pre-VAT for any pre-existing row, the
-- only sane default with no VAT ever having been applied before now).
alter table public.customer_invoices
  add column if not exists subtotal_kobo bigint,
  add column if not exists vat_kobo bigint not null default 0,
  add column if not exists vat_rate_scaled bigint not null default 0;

update public.customer_invoices set subtotal_kobo = amount_kobo where subtotal_kobo is null;
alter table public.customer_invoices alter column subtotal_kobo set not null;

alter table public.customer_invoices drop constraint if exists customer_invoices_totals_check;
alter table public.customer_invoices
  add constraint customer_invoices_totals_check check (amount_kobo = subtotal_kobo + vat_kobo);

alter table public.vendor_bills
  add column if not exists subtotal_kobo bigint,
  add column if not exists vat_kobo bigint not null default 0,
  add column if not exists vat_rate_scaled bigint not null default 0;

update public.vendor_bills set subtotal_kobo = amount_kobo where subtotal_kobo is null;
alter table public.vendor_bills alter column subtotal_kobo set not null;

alter table public.vendor_bills drop constraint if exists vendor_bills_totals_check;
alter table public.vendor_bills
  add constraint vendor_bills_totals_check check (amount_kobo = subtotal_kobo + vat_kobo);

-- 4. Numbering: INV-2026-000001 / BILL-2026-000001, atomic per-org,
-- per-document-type, per-year counter. security definer (unlike
-- generate_employee_id, which predates this codebase's search-path
-- hardening pass) so no direct grant on this table is ever needed by any
-- role — it's touched exclusively through this function.
create table if not exists public.document_number_counters (
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null check (doc_type in ('invoice', 'bill')),
  year int not null,
  last_number int not null default 0,
  primary key (org_id, doc_type, year)
);

alter table public.document_number_counters enable row level security;
-- No policies: every access goes through generate_document_number()
-- below, which bypasses RLS as a security definer function (the same way
-- create_organization already bypasses RLS to bootstrap a brand-new org's
-- chart of accounts) — there is deliberately no direct grant to any role.

create or replace function public.generate_document_number(p_org_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year int := extract(year from now())::int;
  v_number int;
  v_prefix text;
begin
  insert into public.document_number_counters (org_id, doc_type, year, last_number)
  values (p_org_id, p_doc_type, v_year, 1)
  on conflict (org_id, doc_type, year)
  do update set last_number = public.document_number_counters.last_number + 1
  returning last_number into v_number;

  v_prefix := case p_doc_type when 'invoice' then 'INV' when 'bill' then 'BILL' else upper(p_doc_type) end;
  return v_prefix || '-' || v_year || '-' || lpad(v_number::text, 6, '0');
end;
$$;

revoke all on function public.generate_document_number(uuid, text) from public;
grant execute on function public.generate_document_number(uuid, text) to authenticated;

-- Also backfills subtotal_kobo/vat_kobo for any insert that only sets
-- amount_kobo — the recurring-invoice cron job (20260801050000) predates
-- VAT and line items, and still only sets amount_kobo when it turns a due
-- template into a new draft invoice. Rather than touch that function (or
-- any other direct-insert path), treat the whole amount as VAT-free
-- subtotal by default here, the same "no VAT info given" fallback the
-- column backfill above uses for pre-existing rows.
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

drop trigger if exists customer_invoices_set_number_trigger on public.customer_invoices;
create trigger customer_invoices_set_number_trigger
before insert on public.customer_invoices
for each row execute function public.set_customer_invoice_number();

-- Same subtotal_kobo backfill as set_customer_invoice_number, for the
-- exact same reason: the recurring-bill cron job (20260801020000) only
-- sets amount_kobo when it turns a due template into a new pending bill.
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
  if new.subtotal_kobo is null then
    new.subtotal_kobo := new.amount_kobo - coalesce(new.vat_kobo, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_bills_set_number_trigger on public.vendor_bills;
create trigger vendor_bills_set_number_trigger
before insert on public.vendor_bills
for each row execute function public.set_vendor_bill_number();

-- Backfill: every existing invoice/bill missing a number gets one now,
-- same as the employee_id backfill. Safe to re-run — only NULL rows are
-- touched.
update public.customer_invoices set invoice_number = public.generate_document_number(org_id, 'invoice') where invoice_number is null;
update public.vendor_bills set bill_number = public.generate_document_number(org_id, 'bill') where bill_number is null;

alter table public.customer_invoices alter column invoice_number set not null;
alter table public.vendor_bills alter column bill_number set not null;

alter table public.customer_invoices drop constraint if exists customer_invoices_invoice_number_unique;
alter table public.customer_invoices add constraint customer_invoices_invoice_number_unique unique (org_id, invoice_number);

alter table public.vendor_bills drop constraint if exists vendor_bills_bill_number_unique;
alter table public.vendor_bills add constraint vendor_bills_bill_number_unique unique (org_id, bill_number);

-- 5. Atomic creation with line items. security invoker, like every other
-- AP/AR mutation function (approve_vendor_bill, issue_customer_invoice,
-- receive_customer_payment) — the calling admin/payroll_manager already
-- has insert rights on both the header and line tables via the RLS
-- policies above, so this grants no privilege beyond what they already
-- have. Every total is computed here, from the line items, never taken
-- from the client — a client-submitted subtotal/VAT/total is never
-- trusted, the same reasoning receive_customer_payment already applies to
-- an outstanding balance.
create or replace function public.create_customer_invoice_with_lines(
  p_org_id uuid,
  p_customer_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_description text,
  p_lines jsonb
)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
  v_line jsonb;
  v_quantity numeric;
  v_unit_price_kobo bigint;
  v_discount_kobo bigint;
  v_line_total_kobo bigint;
  v_subtotal_kobo bigint := 0;
  v_vat_rate_scaled bigint;
  v_vat_kobo bigint;
  v_sort int := 0;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line item is required';
  end if;

  select coalesce(vat_rate_scaled, 0) into v_vat_rate_scaled
  from public.organizations where id = p_org_id;

  -- First pass: validate and total every line without writing anything
  -- yet, so a bad line fails before the invoice header is ever inserted.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price_kobo := (v_line->>'unit_price_kobo')::bigint;
    v_discount_kobo := coalesce((v_line->>'discount_kobo')::bigint, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Line quantity must be greater than zero';
    end if;
    if v_unit_price_kobo is null or v_unit_price_kobo < 0 then
      raise exception 'Line unit price cannot be negative';
    end if;
    if coalesce(char_length(v_line->>'description'), 0) = 0 then
      raise exception 'Every line item needs a description';
    end if;

    v_line_total_kobo := round(v_quantity * v_unit_price_kobo) - v_discount_kobo;
    if v_line_total_kobo < 0 then
      raise exception 'A line item''s discount cannot exceed its amount';
    end if;

    v_subtotal_kobo := v_subtotal_kobo + v_line_total_kobo;
  end loop;

  v_vat_kobo := (v_subtotal_kobo * v_vat_rate_scaled + 500000) / 1000000;

  insert into public.customer_invoices (
    org_id, customer_id, invoice_date, due_date, description,
    subtotal_kobo, vat_kobo, vat_rate_scaled, amount_kobo, created_by
  )
  values (
    p_org_id, p_customer_id, p_invoice_date, p_due_date, p_description,
    v_subtotal_kobo, v_vat_kobo, v_vat_rate_scaled, v_subtotal_kobo + v_vat_kobo, auth.uid()
  )
  returning * into v_invoice;

  -- Second pass: the same deterministic computation, now actually
  -- inserting each line against the invoice id just created.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort := v_sort + 1;
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price_kobo := (v_line->>'unit_price_kobo')::bigint;
    v_discount_kobo := coalesce((v_line->>'discount_kobo')::bigint, 0);
    v_line_total_kobo := round(v_quantity * v_unit_price_kobo) - v_discount_kobo;

    insert into public.customer_invoice_lines (
      org_id, invoice_id, description, quantity, unit_price_kobo, discount_kobo, line_total_kobo, sort_order
    )
    values (
      p_org_id, v_invoice.id, v_line->>'description', v_quantity, v_unit_price_kobo, v_discount_kobo, v_line_total_kobo, v_sort
    );
  end loop;

  return v_invoice;
end;
$$;

revoke all on function public.create_customer_invoice_with_lines(uuid, uuid, date, date, text, jsonb) from public;
grant execute on function public.create_customer_invoice_with_lines(uuid, uuid, date, date, text, jsonb) to authenticated;

create or replace function public.create_vendor_bill_with_lines(
  p_org_id uuid,
  p_vendor_id uuid,
  p_bill_date date,
  p_due_date date,
  p_description text,
  p_lines jsonb
)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_line jsonb;
  v_quantity numeric;
  v_unit_price_kobo bigint;
  v_discount_kobo bigint;
  v_line_total_kobo bigint;
  v_subtotal_kobo bigint := 0;
  v_vat_rate_scaled bigint;
  v_vat_kobo bigint;
  v_sort int := 0;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one line item is required';
  end if;

  select coalesce(vat_rate_scaled, 0) into v_vat_rate_scaled
  from public.organizations where id = p_org_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price_kobo := (v_line->>'unit_price_kobo')::bigint;
    v_discount_kobo := coalesce((v_line->>'discount_kobo')::bigint, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Line quantity must be greater than zero';
    end if;
    if v_unit_price_kobo is null or v_unit_price_kobo < 0 then
      raise exception 'Line unit price cannot be negative';
    end if;
    if coalesce(char_length(v_line->>'description'), 0) = 0 then
      raise exception 'Every line item needs a description';
    end if;

    v_line_total_kobo := round(v_quantity * v_unit_price_kobo) - v_discount_kobo;
    if v_line_total_kobo < 0 then
      raise exception 'A line item''s discount cannot exceed its amount';
    end if;

    v_subtotal_kobo := v_subtotal_kobo + v_line_total_kobo;
  end loop;

  v_vat_kobo := (v_subtotal_kobo * v_vat_rate_scaled + 500000) / 1000000;

  insert into public.vendor_bills (
    org_id, vendor_id, bill_date, due_date, description,
    subtotal_kobo, vat_kobo, vat_rate_scaled, amount_kobo, requested_by
  )
  values (
    p_org_id, p_vendor_id, p_bill_date, p_due_date, p_description,
    v_subtotal_kobo, v_vat_kobo, v_vat_rate_scaled, v_subtotal_kobo + v_vat_kobo, auth.uid()
  )
  returning * into v_bill;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_sort := v_sort + 1;
    v_quantity := (v_line->>'quantity')::numeric;
    v_unit_price_kobo := (v_line->>'unit_price_kobo')::bigint;
    v_discount_kobo := coalesce((v_line->>'discount_kobo')::bigint, 0);
    v_line_total_kobo := round(v_quantity * v_unit_price_kobo) - v_discount_kobo;

    insert into public.vendor_bill_lines (
      org_id, bill_id, description, quantity, unit_price_kobo, discount_kobo, line_total_kobo, sort_order
    )
    values (
      p_org_id, v_bill.id, v_line->>'description', v_quantity, v_unit_price_kobo, v_discount_kobo, v_line_total_kobo, v_sort
    );
  end loop;

  return v_bill;
end;
$$;

revoke all on function public.create_vendor_bill_with_lines(uuid, uuid, date, date, text, jsonb) from public;
grant execute on function public.create_vendor_bill_with_lines(uuid, uuid, date, date, text, jsonb) to authenticated;

-- 6. Let an org admin update the VAT rate. security invoker, relying on
-- the existing "org admins can update their organization" policy
-- (20260722120357) rather than adding a new one — organization-level
-- settings (name, TIN, pay frequency, and now VAT rate) are admin-only
-- there, unlike the admin/payroll_manager write scope everywhere else in
-- AP/AR, so this deliberately doesn't widen that.
create or replace function public.update_vat_rate(p_org_id uuid, p_vat_rate_scaled bigint)
returns public.organizations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if p_vat_rate_scaled < 0 then
    raise exception 'VAT rate cannot be negative';
  end if;

  update public.organizations
  set vat_rate_scaled = p_vat_rate_scaled
  where id = p_org_id
  returning * into v_org;

  if v_org.id is null then
    raise exception 'Organization % not found', p_org_id;
  end if;

  return v_org;
end;
$$;

revoke all on function public.update_vat_rate(uuid, bigint) from public;
grant execute on function public.update_vat_rate(uuid, bigint) to authenticated;
