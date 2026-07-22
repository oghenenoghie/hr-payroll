create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pay_run_id uuid references public.pay_runs (id) on delete set null,
  memo text not null,
  entry_date date not null,
  created_at timestamptz not null default now()
);

create index journal_entries_org_id_idx on public.journal_entries (org_id);
create index journal_entries_pay_run_id_idx on public.journal_entries (pay_run_id);

create table public.ledger_postings (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  account_code text not null,
  direction text not null check (direction in ('debit', 'credit')),
  amount_kobo bigint not null check (amount_kobo > 0),
  employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ledger_postings_journal_entry_id_idx on public.ledger_postings (journal_entry_id);
create index ledger_postings_org_id_idx on public.ledger_postings (org_id);
create index ledger_postings_employee_id_idx on public.ledger_postings (employee_id);

create or replace function core.validate_journal_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debits bigint;
  v_credits bigint;
begin
  select
    coalesce(sum(amount_kobo) filter (where direction = 'debit'), 0),
    coalesce(sum(amount_kobo) filter (where direction = 'credit'), 0)
  into v_debits, v_credits
  from public.ledger_postings
  where journal_entry_id = new.journal_entry_id;

  if v_debits <> v_credits then
    raise exception 'Journal entry % is not balanced: debits=% credits=%', new.journal_entry_id, v_debits, v_credits;
  end if;
  return null;
end;
$$;

revoke execute on function core.validate_journal_balance() from public, anon, authenticated;

create constraint trigger validate_journal_balance_trigger
after insert on public.ledger_postings
deferrable initially deferred
for each row
execute function core.validate_journal_balance();

alter table public.journal_entries enable row level security;
alter table public.ledger_postings enable row level security;

create policy "admins and payroll managers can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can create journal entries"
on public.journal_entries for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can create ledger postings"
on public.ledger_postings for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));
