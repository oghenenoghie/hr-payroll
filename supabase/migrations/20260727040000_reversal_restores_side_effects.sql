-- Closes part of the reversal scope gap the original payroll-reversal
-- migration disclosed honestly rather than guessed at: reversal now
-- restores the exact same side effects discard_pay_run_draft already
-- restores for a draft — loan outstanding balances, and expense/leave/
-- attendance/overtime/leave-encashment rows this run consumed go back to
-- a re-payable state, keyed off this pay run's own loan_repayments rows
-- and paid_pay_run_id markers, so they're picked up correctly by
-- whatever run replaces this one.
--
-- What stays exactly as it was, deliberately: the correcting-journal-
-- entry mechanism (every posting re-inserted with direction flipped) and
-- the original postings/payslips, which are never edited or deleted —
-- append-only, matching this codebase's audit-event philosophy. A
-- reversed run's payslips remain visible on its own detail page and in
-- the payroll register for the audit trail; only posted_payslips (via
-- pay_runs.status != 'draft') and every other cross-run read site
-- already excluded a 'reversed' run's numbers from totals, unchanged by
-- this migration.
--
-- What's still explicitly NOT addressed, per feature-backlog.md's
-- "Payroll reversal and correction" section: what a reversal means for
-- statutory amounts already remitted to a tax/pension authority, and
-- whether a reversal after a filing deadline requires an amended filing.
-- Both remain open questions this migration does not attempt to answer.
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
