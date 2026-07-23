-- Payroll reversal — feature-backlog.md §1's "hardest correctness area":
-- gives admins a real, audited way to undo a finalised pay run's ledger
-- impact via a correcting journal entry (every posting re-inserted with
-- direction flipped, same account and amount) — never an edit or delete
-- of the original postings or payslips, which stay exactly as originally
-- computed (append-only, matching this codebase's audit-event philosophy
-- and the skill's explicit instruction: "Correcting-entry mechanics
-- through packages/ledger — never an edit in place").
--
-- Deliberately narrow scope, disclosed honestly rather than guessed at:
-- this reverses the LEDGER impact only. It does NOT restore loan
-- outstanding balances, or revert expense/leave/attendance/overtime rows
-- this run marked consumed (paid_pay_run_id / status='paid') back to a
-- re-payable state, and it does NOT address what a reversal means for
-- statutory amounts already remitted to a tax/pension authority — both
-- are still-open questions per feature-backlog.md ("Reversal of a
-- finalised run — and what that does to already-remitted statutory
-- liabilities" and "whether a reversal after a filing deadline requires
-- an amended filing, per scheme"). What this DOES give: a correct ledger
-- and a real audit trail after a fat-fingered or duplicate run, which
-- today has no remedy at all.
--
-- Admin-only — deliberately a higher bar than pay-run creation
-- (admin/payroll_manager), given how consequential and hard to fully
-- undo this action is.
alter table public.pay_runs
  add column status text not null default 'posted' check (status in ('posted', 'reversed'));

create table public.pay_run_reversals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pay_run_id uuid not null unique references public.pay_runs (id) on delete cascade,
  reversal_journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  reversed_by uuid not null,
  reason text not null check (char_length(reason) > 0),
  created_at timestamptz not null default now()
);

create index pay_run_reversals_org_id_idx on public.pay_run_reversals (org_id);

alter table public.pay_run_reversals enable row level security;

create policy "admins and payroll managers can view pay run reversals"
on public.pay_run_reversals for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create or replace function public.reverse_pay_run(p_pay_run_id uuid, p_reason text)
returns public.pay_run_reversals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
  v_original_journal_entry_id uuid;
  v_reversal_journal_entry_id uuid;
  v_orig_posting record;
  v_result public.pay_run_reversals;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin']) then
    raise exception 'You do not have permission to reverse a pay run for this organization';
  end if;

  if v_pay_run.status = 'reversed' then
    raise exception 'This pay run has already been reversed';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reverse a pay run';
  end if;

  select id into v_original_journal_entry_id
  from public.journal_entries
  where pay_run_id = p_pay_run_id
  order by created_at asc
  limit 1;

  if v_original_journal_entry_id is null then
    raise exception 'No journal entry found for pay run %', p_pay_run_id;
  end if;

  insert into public.journal_entries (org_id, pay_run_id, memo, entry_date)
  values (v_pay_run.org_id, p_pay_run_id, 'Reversal: ' || p_reason, current_date)
  returning id into v_reversal_journal_entry_id;

  for v_orig_posting in
    select account_code, direction, amount_kobo, employee_id
    from public.ledger_postings
    where journal_entry_id = v_original_journal_entry_id
  loop
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo, employee_id)
    values (
      v_reversal_journal_entry_id,
      v_pay_run.org_id,
      v_orig_posting.account_code,
      case when v_orig_posting.direction = 'debit' then 'credit' else 'debit' end,
      v_orig_posting.amount_kobo,
      v_orig_posting.employee_id
    );
  end loop;

  update public.pay_runs set status = 'reversed' where id = p_pay_run_id;

  insert into public.pay_run_reversals (org_id, pay_run_id, reversal_journal_entry_id, reversed_by, reason)
  values (v_pay_run.org_id, p_pay_run_id, v_reversal_journal_entry_id, auth.uid(), p_reason)
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.reverse_pay_run(uuid, text) from public;
grant execute on function public.reverse_pay_run(uuid, text) to authenticated;
