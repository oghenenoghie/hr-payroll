-- Statutory remittance tracking + reversal awareness — closes the two
-- "still open" items in feature-backlog.md's "Payroll reversal and
-- correction" section as far as they CAN be closed without inventing
-- statutory guidance this build has no authority to give:
--
--   1. "Reversal of a finalised run — and what that does to already-
--      remitted statutory liabilities." Until now this build had no way
--      to record that a remittance happened at all — the statutory-
--      deadline-reminder migration's own comment says so directly:
--      "this build has never modeled a remittance being marked paid."
--      reverse_pay_run's correcting journal entry always mechanically
--      nets the ledger back to zero, which is correct bookkeeping, but
--      if the money already left the business for a specific filing,
--      that correction doesn't undo the real-world payment. This
--      migration adds a record of that payment and makes reversal
--      require an explicit, logged acknowledgment before proceeding
--      when one exists for the run being reversed, rather than silently
--      proceeding as if the run had never been paid to the authority.
--   2. "Whether a reversal after a filing deadline requires an amended
--      filing, per scheme." Still explicitly NOT answered here — that's
--      a real tax-professional question, decided per scheme, per
--      authority, per how close the run is to its deadline, and
--      guessing at it risks telling an employer the wrong thing to do
--      with a regulator. The acknowledgment path says exactly that
--      instead of pretending to resolve it.
--
-- Scoped to the four schemes this build actually posts liabilities for
-- (paye_payable/pension_payable/nhf_payable/nsitf_payable — the same
-- "applied" set /compliance and /reports already use; ITF and WHT are
-- "documented, not yet applied" and have no liability to remit against).
create table public.statutory_remittances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  scheme text not null check (scheme in ('paye', 'pension', 'nhf', 'nsitf')),
  amount_kobo bigint not null check (amount_kobo > 0),
  remitted_on date not null,
  reference text,
  notes text,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index statutory_remittances_pay_run_id_idx on public.statutory_remittances (pay_run_id);
create index statutory_remittances_org_id_idx on public.statutory_remittances (org_id);

alter table public.statutory_remittances enable row level security;

-- Read access matches exactly who can already reach pay_runs itself
-- (the natural home for this data, on the pay run detail page) —
-- admin/payroll_manager (payroll_core), auditor (auditor_read_access),
-- finance_manager (compensation_and_finance_roles) and chro
-- (chro_and_legal_compliance_roles). A narrower policy than that would
-- make a viewer who can already see the run's statutory postings see a
-- remittance as if it had never happened; a broader one would show
-- remittance data to a role that can't even reach the pay run itself.
create policy "payroll-visible roles can view statutory remittances"
on public.statutory_remittances for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'auditor', 'finance_manager', 'chro']));

-- No insert/update/delete policy for anyone — every write goes through
-- record_statutory_remittance, which gates who may record real money
-- having left the business more narrowly than who may merely see that
-- it did (admin/payroll_manager/finance_manager, the same three roles
-- the statutory-deadline-reminder job already treats as "who cares
-- about this"). Append-only, same kept-record convention as every other
-- audit table in this build — a correction is a new row, never an edit.
create or replace function public.record_statutory_remittance(
  p_pay_run_id uuid,
  p_scheme text,
  p_amount_kobo bigint,
  p_remitted_on date,
  p_reference text default null,
  p_notes text default null
)
returns public.statutory_remittances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
  v_result public.statutory_remittances;
begin
  if p_scheme not in ('paye', 'pension', 'nhf', 'nsitf') then
    raise exception 'Invalid scheme: %', p_scheme;
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'A positive remitted amount is required';
  end if;

  if p_remitted_on is null then
    raise exception 'A remittance date is required';
  end if;

  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;
  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'finance_manager']) then
    raise exception 'You do not have permission to record a statutory remittance for this organization';
  end if;

  insert into public.statutory_remittances (org_id, pay_run_id, scheme, amount_kobo, remitted_on, reference, notes, recorded_by)
  values (
    v_pay_run.org_id,
    p_pay_run_id,
    p_scheme,
    p_amount_kobo,
    p_remitted_on,
    nullif(trim(p_reference), ''),
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_statutory_remittance(uuid, text, bigint, date, text, text) from public;
grant execute on function public.record_statutory_remittance(uuid, text, bigint, date, text, text) to authenticated;

-- Old two-argument signature dropped, not just superseded — leaving it
-- callable alongside a new three-argument overload would let a caller
-- route around the remittance check below entirely by calling the old
-- signature, which Postgres would treat as a distinct, un-updated
-- function rather than replacing it.
drop function if exists public.reverse_pay_run(uuid, text);

create or replace function public.reverse_pay_run(
  p_pay_run_id uuid,
  p_reason text,
  p_acknowledge_remitted boolean default false
)
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
  v_remitted_summary text;
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

  -- Doesn't block the reversal outright — that would itself be a guess
  -- at an unconfirmed rule (maybe the correction is fine even after
  -- remittance; maybe it needs an amended filing; this build has no
  -- authority to decide that per scheme, per authority, per deadline).
  -- It forces a conscious, logged choice instead of a silent one: the
  -- first call without acknowledgment fails and names exactly which
  -- scheme(s), how much, and when, so the caller sees precisely what
  -- real-world payment the ledger correction below will not undo.
  if not p_acknowledge_remitted then
    select string_agg(scheme || ': ' || amount_kobo || ' kobo remitted ' || remitted_on, '; ' order by scheme)
    into v_remitted_summary
    from public.statutory_remittances
    where pay_run_id = p_pay_run_id;

    if v_remitted_summary is not null then
      raise exception 'This run has recorded statutory remittances already sent to the relevant authorities: %. Reversing corrects the ledger but does not undo that payment, and does not address whether an amended filing is required — confirm that separately, then retry with acknowledgment.', v_remitted_summary;
    end if;
  end if;

  select id into v_original_journal_entry_id
  from public.journal_entries
  where pay_run_id = p_pay_run_id
  order by created_at asc
  limit 1;

  if v_original_journal_entry_id is null then
    raise exception 'No journal entry found for pay run %', p_pay_run_id;
  end if;

  -- Same restoration logic as discard_pay_run_draft, applied to a posted
  -- run instead of a discarded draft: put every consumed side effect back
  -- to a re-payable state.
  update public.loans l
  set
    outstanding_kobo = l.outstanding_kobo + r.amount_kobo,
    status = case when l.status = 'completed' then 'approved' else l.status end
  from public.loan_repayments r
  where r.pay_run_id = p_pay_run_id and r.loan_id = l.id;

  update public.expenses
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.leave_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.attendance_records
  set paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id;

  update public.overtime_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

  update public.leave_encashment_requests
  set status = 'approved', paid_pay_run_id = null
  where paid_pay_run_id = p_pay_run_id and status = 'paid';

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

revoke all on function public.reverse_pay_run(uuid, text, boolean) from public;
grant execute on function public.reverse_pay_run(uuid, text, boolean) to authenticated;
