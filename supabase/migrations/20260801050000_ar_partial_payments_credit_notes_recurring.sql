-- Three Accounts Receivable gaps closed together: partial payments,
-- credit notes, recurring invoices (the aging report needs no schema
-- change, just this migration's outstanding-balance model to query
-- against).
--
-- Outstanding balance is never a stored column, matching this codebase's
-- "derived, never separately entered" convention (Budgets, P&L): it's
-- always amount_kobo minus every payment and credit note posted against
-- an invoice, computed on read. customer_invoices.status keeps its
-- existing four values (draft/issued/paid/void) — no new status, no
-- constraint change — 'paid' now means "fully settled" (outstanding
-- reaches zero via one or more payments and/or credit notes together)
-- rather than strictly "one payment for the full amount", and 'issued'
-- covers both untouched and partially-paid invoices.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE), matching every migration since 20260730010000:
-- this project's operator applies migrations by hand in the SQL Editor.
create table if not exists public.customer_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  payment_date date not null,
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  received_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists customer_invoice_payments_org_id_idx on public.customer_invoice_payments (org_id);
create index if not exists customer_invoice_payments_invoice_id_idx on public.customer_invoice_payments (invoice_id);

create table if not exists public.customer_credit_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.customer_invoices (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  reason text not null check (char_length(reason) > 0),
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  issued_by uuid not null references auth.users (id),
  issued_at timestamptz not null default now()
);

create index if not exists customer_credit_notes_org_id_idx on public.customer_credit_notes (org_id);
create index if not exists customer_credit_notes_invoice_id_idx on public.customer_credit_notes (invoice_id);

create table if not exists public.customer_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  description text not null check (char_length(description) > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'annually')),
  next_invoice_date date not null,
  active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists customer_invoice_templates_org_id_idx on public.customer_invoice_templates (org_id);
create index if not exists customer_invoice_templates_active_next_invoice_date_idx
  on public.customer_invoice_templates (active, next_invoice_date);

alter table public.customer_invoice_payments enable row level security;
alter table public.customer_credit_notes enable row level security;
alter table public.customer_invoice_templates enable row level security;

-- Payments and credit notes are only ever written by the functions below
-- (security invoker, so every insert still goes through these same
-- policies for whoever calls them) — no client ever inserts either table
-- directly, matching the vendor_bills/customer_invoices convention of an
-- "update policy that exists only to satisfy the atomic function".
drop policy if exists "admins, payroll managers and accountants can view invoice payments" on public.customer_invoice_payments;
create policy "admins, payroll managers and accountants can view invoice payments"
on public.customer_invoice_payments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add invoice payments" on public.customer_invoice_payments;
create policy "admins and payroll managers can add invoice payments"
on public.customer_invoice_payments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view credit notes" on public.customer_credit_notes;
create policy "admins, payroll managers and accountants can view credit notes"
on public.customer_credit_notes for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add credit notes" on public.customer_credit_notes;
create policy "admins and payroll managers can add credit notes"
on public.customer_credit_notes for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view recurring invoices" on public.customer_invoice_templates;
create policy "admins, payroll managers and accountants can view recurring invoices"
on public.customer_invoice_templates for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add recurring invoices" on public.customer_invoice_templates;
create policy "admins and payroll managers can add recurring invoices"
on public.customer_invoice_templates for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can update recurring invoices" on public.customer_invoice_templates;
create policy "admins and payroll managers can update recurring invoices"
on public.customer_invoice_templates for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can delete recurring invoices" on public.customer_invoice_templates;
create policy "admins and payroll managers can delete recurring invoices"
on public.customer_invoice_templates for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Replaces the old all-or-nothing receive_customer_payment: p_amount_kobo
-- defaults to null, meaning "pay whatever is still outstanding" (the old
-- full-payment behavior, unchanged for the common case), or an explicit
-- lesser amount for a genuine partial payment. Each call inserts one
-- customer_invoice_payments row — the full payment history — and the
-- invoice only flips to 'paid' once every payment and credit note
-- together fully covers amount_kobo. payment_journal_entry_id on the
-- invoice itself is set only by whichever payment actually settles it
-- (matching its pre-existing single-FK meaning); customer_invoice_payments
-- is the authoritative record of every payment, partial or final.
--
-- The old single-argument signature is dropped explicitly first: adding
-- a defaulted second parameter via plain CREATE OR REPLACE would leave
-- both signatures registered as distinct overloads (Postgres identifies
-- a function by its argument *types*, not by name alone), and calling
-- with one argument would then be genuinely ambiguous between them.
drop function if exists public.receive_customer_payment(uuid);

create or replace function public.receive_customer_payment(p_invoice_id uuid, p_amount_kobo bigint default null)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
  v_already_settled_kobo bigint;
  v_outstanding_kobo bigint;
  v_amount_kobo bigint;
  v_journal_entry_id uuid;
begin
  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;

  if v_invoice.id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if v_invoice.status <> 'issued' then
    raise exception 'Invoice % is not issued (status: %)', p_invoice_id, v_invoice.status;
  end if;

  select coalesce(sum(amount_kobo), 0) into v_already_settled_kobo
  from public.customer_invoice_payments where invoice_id = p_invoice_id;
  v_already_settled_kobo := v_already_settled_kobo + coalesce((
    select sum(amount_kobo) from public.customer_credit_notes where invoice_id = p_invoice_id
  ), 0);
  v_outstanding_kobo := v_invoice.amount_kobo - v_already_settled_kobo;

  v_amount_kobo := coalesce(p_amount_kobo, v_outstanding_kobo);
  if v_amount_kobo <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if v_amount_kobo > v_outstanding_kobo then
    raise exception 'Payment of % exceeds the % still outstanding on invoice %', v_amount_kobo, v_outstanding_kobo, p_invoice_id;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_invoice.org_id, 'Customer invoice paid: ' || v_invoice.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_invoice.org_id, 'cash_and_bank', 'debit', v_amount_kobo),
    (v_journal_entry_id, v_invoice.org_id, 'accounts_receivable', 'credit', v_amount_kobo);

  insert into public.customer_invoice_payments (org_id, invoice_id, amount_kobo, payment_date, journal_entry_id, received_by)
  values (v_invoice.org_id, p_invoice_id, v_amount_kobo, current_date, v_journal_entry_id, auth.uid());

  if v_amount_kobo = v_outstanding_kobo then
    update public.customer_invoices
    set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
    where id = p_invoice_id
    returning * into v_invoice;
  else
    select * into v_invoice from public.customer_invoices where id = p_invoice_id;
  end if;

  return v_invoice;
end;
$$;

revoke all on function public.receive_customer_payment(uuid, bigint) from public;
grant execute on function public.receive_customer_payment(uuid, bigint) to authenticated;

-- Credit note: reduces what's owed without any cash movement — debits
-- whichever revenue account the original invoice actually credited
-- (looked up from its own journal entry, not hardcoded to
-- 'sales_revenue', in case a future caller ever issues against a
-- different one) and credits accounts_receivable, the mirror image of
-- issue_customer_invoice's own posting. Capped at what's still
-- outstanding — a credit note can reduce a balance to zero but never
-- past it. Reaching zero flips the invoice to 'paid' the same way a
-- payment does, since "paid" here means "fully settled", not
-- specifically "settled in cash".
create or replace function public.issue_credit_note(p_invoice_id uuid, p_amount_kobo bigint, p_reason text)
returns public.customer_invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices;
  v_already_settled_kobo bigint;
  v_outstanding_kobo bigint;
  v_revenue_account_code text;
  v_journal_entry_id uuid;
begin
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A credit note needs a reason';
  end if;

  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;
  if v_invoice.id is null then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if v_invoice.status <> 'issued' then
    raise exception 'Invoice % is not issued (status: %)', p_invoice_id, v_invoice.status;
  end if;

  select coalesce(sum(amount_kobo), 0) into v_already_settled_kobo
  from public.customer_invoice_payments where invoice_id = p_invoice_id;
  v_already_settled_kobo := v_already_settled_kobo + coalesce((
    select sum(amount_kobo) from public.customer_credit_notes where invoice_id = p_invoice_id
  ), 0);
  v_outstanding_kobo := v_invoice.amount_kobo - v_already_settled_kobo;

  if p_amount_kobo <= 0 then
    raise exception 'Credit note amount must be greater than zero';
  end if;
  if p_amount_kobo > v_outstanding_kobo then
    raise exception 'Credit note of % exceeds the % still outstanding on invoice %', p_amount_kobo, v_outstanding_kobo, p_invoice_id;
  end if;

  select account_code into v_revenue_account_code
  from public.ledger_postings
  where journal_entry_id = v_invoice.journal_entry_id and direction = 'credit'
  limit 1;
  v_revenue_account_code := coalesce(v_revenue_account_code, 'sales_revenue');

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_invoice.org_id, 'Credit note: ' || v_invoice.description || ' — ' || p_reason, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_invoice.org_id, v_revenue_account_code, 'debit', p_amount_kobo),
    (v_journal_entry_id, v_invoice.org_id, 'accounts_receivable', 'credit', p_amount_kobo);

  insert into public.customer_credit_notes (org_id, invoice_id, amount_kobo, reason, journal_entry_id, issued_by)
  values (v_invoice.org_id, p_invoice_id, p_amount_kobo, p_reason, v_journal_entry_id, auth.uid());

  if p_amount_kobo = v_outstanding_kobo then
    update public.customer_invoices
    set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
    where id = p_invoice_id
    returning * into v_invoice;
  else
    select * into v_invoice from public.customer_invoices where id = p_invoice_id;
  end if;

  return v_invoice;
end;
$$;

revoke all on function public.issue_credit_note(uuid, bigint, text) from public;
grant execute on function public.issue_credit_note(uuid, bigint, text) to authenticated;

-- Recurring invoices: same pattern as vendor_bill_templates
-- (20260801020000), generating a new DRAFT invoice on schedule rather
-- than pending_approval — issuing recognizes revenue immediately, a
-- bigger commitment than a vendor bill's approval step, so every
-- generated invoice still needs a human to review and Issue it.
-- Not security definer, matching core.check_lifecycle_deadlines and
-- core.generate_recurring_vendor_bills: pg_cron jobs in this project run
-- as the role that scheduled them (postgres), already bypassing RLS.
create or replace function core.generate_recurring_customer_invoices()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_template record;
  v_next_date date;
begin
  for v_template in
    select * from public.customer_invoice_templates
    where active = true and next_invoice_date <= current_date
  loop
    insert into public.customer_invoices (org_id, customer_id, invoice_date, amount_kobo, description, status, created_by)
    values (
      v_template.org_id,
      v_template.customer_id,
      v_template.next_invoice_date,
      v_template.amount_kobo,
      v_template.description,
      'draft',
      v_template.created_by
    );

    v_next_date := (case v_template.cadence
      when 'weekly' then v_template.next_invoice_date + interval '7 days'
      when 'monthly' then v_template.next_invoice_date + interval '1 month'
      when 'quarterly' then v_template.next_invoice_date + interval '3 months'
      when 'annually' then v_template.next_invoice_date + interval '1 year'
      else v_template.next_invoice_date + interval '1 month'
    end)::date;

    update public.customer_invoice_templates set next_invoice_date = v_next_date where id = v_template.id;
  end loop;
end;
$$;

revoke execute on function core.generate_recurring_customer_invoices() from public, anon, authenticated;

select cron.schedule('generate-recurring-customer-invoices', '0 6 * * *', $$select core.generate_recurring_customer_invoices();$$);
