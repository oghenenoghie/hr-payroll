-- Bank/Cash Reconciliation v1 — the control step that closes the loop on
-- every other accounting module built so far: payroll, accounts payable
-- and accounts receivable all eventually post to cash_and_bank, but
-- nothing until now checks that what the books say happened to cash
-- actually matches what the bank says happened. There's no live bank
-- API in this build (see Integrations), so the bank side is entered by
-- hand from the actual statement — this is the same manual-entry
-- approach every real reconciliation tool falls back to when no feed is
-- connected.
--
-- Model: a reconciliation is a dated snapshot (period_end + the ending
-- balance printed on the statement, entered by a human). Statement lines
-- belonging to that snapshot get matched 1:1 against cash_and_bank ledger
-- postings. What's left unmatched on either side is exactly the
-- "reconciling items" a real bank reconciliation statement lists —
-- deposits in transit, outstanding withdrawals, bank fees not yet
-- booked. Completing a reconciliation doesn't post anything to the
-- ledger itself (it's an attestation/control record, not a journal
-- entry) and, once completed, is immutable — no reopen in this build; a
-- mistake gets corrected by starting a fresh reconciliation, disclosed
-- honestly on the feature map rather than half-built.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS), matching
-- every migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor, so a half-applied or repeated run
-- must be safe to redo from the top.
create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_end date not null,
  -- The ground truth: the ending balance actually printed on the
  -- statement, not derived from anything in this database.
  statement_balance_kobo bigint not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  completed_at timestamptz,
  completed_by uuid references auth.users (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists bank_reconciliations_org_id_idx on public.bank_reconciliations (org_id);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  reconciliation_id uuid not null references public.bank_reconciliations (id) on delete cascade,
  line_date date not null,
  description text not null check (char_length(description) > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  -- Deliberately "deposit"/"withdrawal", not "debit"/"credit" — a real
  -- bank statement's own debit/credit labelling is from the bank's
  -- point of view (a deposit is a credit to *your* account but the
  -- bank's liability increasing), which is a well-known source of
  -- reconciliation mistakes. Plain English avoids it entirely.
  type text not null check (type in ('deposit', 'withdrawal')),
  matched_posting_id uuid references public.ledger_postings (id) on delete set null,
  matched_at timestamptz,
  matched_by uuid references auth.users (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists bank_statement_lines_org_id_idx on public.bank_statement_lines (org_id);
create index if not exists bank_statement_lines_reconciliation_id_idx on public.bank_statement_lines (reconciliation_id);
-- A ledger posting can back at most one statement line — prevents the
-- same cash movement being claimed as "cleared" twice.
create unique index if not exists bank_statement_lines_matched_posting_id_key
on public.bank_statement_lines (matched_posting_id)
where matched_posting_id is not null;

alter table public.bank_reconciliations enable row level security;
alter table public.bank_statement_lines enable row level security;

drop policy if exists "admins, payroll managers and accountants can view reconciliations" on public.bank_reconciliations;
create policy "admins, payroll managers and accountants can view reconciliations"
on public.bank_reconciliations for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add reconciliations" on public.bank_reconciliations;
create policy "admins and payroll managers can add reconciliations"
on public.bank_reconciliations for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Only complete_bank_reconciliation below actually updates a
-- reconciliation — this policy exists because it runs security invoker
-- (as the calling user, through normal RLS) rather than security
-- definer, so it needs something to satisfy. No client ever updates
-- bank_reconciliations directly.
drop policy if exists "admins and payroll managers can update reconciliations" on public.bank_reconciliations;
create policy "admins and payroll managers can update reconciliations"
on public.bank_reconciliations for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins, payroll managers and accountants can view statement lines" on public.bank_statement_lines;
create policy "admins, payroll managers and accountants can view statement lines"
on public.bank_statement_lines for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add statement lines" on public.bank_statement_lines;
create policy "admins and payroll managers can add statement lines"
on public.bank_statement_lines for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can update statement lines" on public.bank_statement_lines;
create policy "admins and payroll managers can update statement lines"
on public.bank_statement_lines for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can delete statement lines" on public.bank_statement_lines;
create policy "admins and payroll managers can delete statement lines"
on public.bank_statement_lines for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- security invoker (like every other atomic function in this build) —
-- every read/write still goes through the RLS policies above for
-- whoever calls it; this function grants no privilege beyond what the
-- caller's role already has.
create or replace function public.match_bank_statement_line(p_line_id uuid, p_posting_id uuid)
returns public.bank_statement_lines
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_line public.bank_statement_lines;
  v_reconciliation public.bank_reconciliations;
  v_posting public.ledger_postings;
begin
  select * into v_line from public.bank_statement_lines where id = p_line_id for update;
  if v_line.id is null then
    raise exception 'Statement line % not found', p_line_id;
  end if;

  select * into v_reconciliation from public.bank_reconciliations where id = v_line.reconciliation_id;
  if v_reconciliation.status <> 'in_progress' then
    raise exception 'Reconciliation % is not in progress (status: %)', v_reconciliation.id, v_reconciliation.status;
  end if;

  select * into v_posting from public.ledger_postings where id = p_posting_id;
  if v_posting.id is null then
    raise exception 'Ledger posting % not found', p_posting_id;
  end if;
  if v_posting.org_id <> v_line.org_id then
    raise exception 'Posting % belongs to a different organization', p_posting_id;
  end if;
  if v_posting.account_code <> 'cash_and_bank' then
    raise exception 'Posting % is not a cash_and_bank posting', p_posting_id;
  end if;
  if exists (select 1 from public.bank_statement_lines where matched_posting_id = p_posting_id) then
    raise exception 'Posting % is already matched to another statement line', p_posting_id;
  end if;

  update public.bank_statement_lines
  set matched_posting_id = p_posting_id, matched_at = now(), matched_by = auth.uid()
  where id = p_line_id
  returning * into v_line;

  return v_line;
end;
$$;

create or replace function public.unmatch_bank_statement_line(p_line_id uuid)
returns public.bank_statement_lines
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_line public.bank_statement_lines;
  v_reconciliation public.bank_reconciliations;
begin
  select * into v_line from public.bank_statement_lines where id = p_line_id for update;
  if v_line.id is null then
    raise exception 'Statement line % not found', p_line_id;
  end if;

  select * into v_reconciliation from public.bank_reconciliations where id = v_line.reconciliation_id;
  if v_reconciliation.status <> 'in_progress' then
    raise exception 'Reconciliation % is not in progress (status: %)', v_reconciliation.id, v_reconciliation.status;
  end if;

  update public.bank_statement_lines
  set matched_posting_id = null, matched_at = null, matched_by = null
  where id = p_line_id
  returning * into v_line;

  return v_line;
end;
$$;

create or replace function public.complete_bank_reconciliation(p_reconciliation_id uuid)
returns public.bank_reconciliations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reconciliation public.bank_reconciliations;
begin
  select * into v_reconciliation from public.bank_reconciliations where id = p_reconciliation_id for update;
  if v_reconciliation.id is null then
    raise exception 'Reconciliation % not found', p_reconciliation_id;
  end if;
  if v_reconciliation.status <> 'in_progress' then
    raise exception 'Reconciliation % is not in progress (status: %)', p_reconciliation_id, v_reconciliation.status;
  end if;

  update public.bank_reconciliations
  set status = 'completed', completed_by = auth.uid(), completed_at = now()
  where id = p_reconciliation_id
  returning * into v_reconciliation;

  return v_reconciliation;
end;
$$;

revoke all on function public.match_bank_statement_line(uuid, uuid) from public;
revoke all on function public.unmatch_bank_statement_line(uuid) from public;
revoke all on function public.complete_bank_reconciliation(uuid) from public;
grant execute on function public.match_bank_statement_line(uuid, uuid) to authenticated;
grant execute on function public.unmatch_bank_statement_line(uuid) to authenticated;
grant execute on function public.complete_bank_reconciliation(uuid) to authenticated;
