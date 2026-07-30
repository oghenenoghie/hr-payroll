-- Accounts Payable v1 (feature-map request: "connect payroll, employees,
-- expenses, taxes... to accounting" — this is the first ledger domain
-- that isn't payroll-driven). Vendor bills post real double-entry
-- journal entries the same way a pay run does, on an accrual basis:
--
--   Approved  -> debit an expense account, credit accounts_payable
--                (the liability is recognized when the bill is approved,
--                not when it's paid)
--   Paid      -> debit accounts_payable, credit cash_and_bank
--                (settling the liability, modelling the actual cash
--                outflow — the first posting in this codebase that does,
--                since payroll disbursement itself isn't built yet)
--
-- Not built here: recurring bills, payment batches, supplier statements,
-- multi-currency — this is the maker/approve/pay lifecycle and the
-- ledger integration, disclosed honestly on the feature map.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  contact_email text,
  contact_phone text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index vendors_org_id_idx on public.vendors (org_id);

create table public.vendor_bills (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  bill_number text,
  bill_date date not null,
  due_date date,
  amount_kobo bigint not null check (amount_kobo > 0),
  description text not null check (char_length(description) > 0),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'paid')),
  requested_by uuid not null references auth.users (id),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  paid_at timestamptz,
  journal_entry_id uuid references public.journal_entries (id) on delete set null,
  payment_journal_entry_id uuid references public.journal_entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create index vendor_bills_org_id_idx on public.vendor_bills (org_id);
create index vendor_bills_vendor_id_idx on public.vendor_bills (vendor_id);
create index vendor_bills_status_idx on public.vendor_bills (status);

alter table public.vendors enable row level security;
alter table public.vendor_bills enable row level security;

create policy "admins, payroll managers and accountants can view vendors"
on public.vendors for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins and payroll managers can add vendors"
on public.vendors for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can update vendors"
on public.vendors for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can delete vendors"
on public.vendors for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins, payroll managers and accountants can view vendor bills"
on public.vendor_bills for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins and payroll managers can add vendor bills"
on public.vendor_bills for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Only the approve/reject/pay functions below actually update a bill —
-- this policy exists because they run security invoker (as the calling
-- user, through normal RLS) rather than security definer, so they need
-- something to satisfy. No client ever updates vendor_bills directly.
create policy "admins and payroll managers can update vendor bills"
on public.vendor_bills for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Accountant joins the two roles that could already see the ledger —
-- the read-only reconciliation role from the roles/permissions migration
-- gets its first real payoff here.
drop policy "admins and payroll managers can view journal entries" on public.journal_entries;
create policy "admins, payroll managers and accountants can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy "admins and payroll managers can view ledger postings" on public.ledger_postings;
create policy "admins, payroll managers and accountants can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

-- Atomic approve: recognizes the liability. security invoker (like
-- create_pay_run) — every insert still goes through the RLS policies
-- above for whoever calls it; this function grants no privilege beyond
-- what the caller's role already has.
create or replace function public.approve_vendor_bill(p_bill_id uuid, p_expense_account_code text default 'vendor_expense')
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_journal_entry_id uuid;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'pending_approval' then
    raise exception 'Bill % is not pending approval (status: %)', p_bill_id, v_bill.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_bill.org_id, 'Vendor bill approved: ' || v_bill.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_bill.org_id, p_expense_account_code, 'debit', v_bill.amount_kobo),
    (v_journal_entry_id, v_bill.org_id, 'accounts_payable', 'credit', v_bill.amount_kobo);

  update public.vendor_bills
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), journal_entry_id = v_journal_entry_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

create or replace function public.reject_vendor_bill(p_bill_id uuid)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'pending_approval' then
    raise exception 'Bill % is not pending approval (status: %)', p_bill_id, v_bill.status;
  end if;

  update public.vendor_bills
  set status = 'rejected', approved_by = auth.uid(), approved_at = now()
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

-- Atomic payment: settles the liability against cash — the first
-- posting in this codebase to actually credit a cash/bank account, since
-- payroll disbursement itself doesn't model cash movement yet.
create or replace function public.pay_vendor_bill(p_bill_id uuid)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_journal_entry_id uuid;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'approved' then
    raise exception 'Bill % is not approved (status: %)', p_bill_id, v_bill.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_bill.org_id, 'Vendor bill paid: ' || v_bill.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_bill.org_id, 'accounts_payable', 'debit', v_bill.amount_kobo),
    (v_journal_entry_id, v_bill.org_id, 'cash_and_bank', 'credit', v_bill.amount_kobo);

  update public.vendor_bills
  set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.approve_vendor_bill(uuid, text) from public;
revoke all on function public.reject_vendor_bill(uuid) from public;
revoke all on function public.pay_vendor_bill(uuid) from public;
grant execute on function public.approve_vendor_bill(uuid, text) to authenticated;
grant execute on function public.reject_vendor_bill(uuid) to authenticated;
grant execute on function public.pay_vendor_bill(uuid) to authenticated;
