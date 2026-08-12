-- Vendor bill lifecycle upgrade — Bills has been the thinnest workflow
-- in the app: pending_approval -> approved -> paid, plus rejected, with
-- no way to queue a payment ahead of the actual disbursement date and
-- no way to walk back an approved bill that turns out to be wrong
-- without leaving it stuck in limbo. Adds two new states:
--
--   approved -> scheduled -> paid   (an optional step: paying directly
--                                     from 'approved' still works exactly
--                                     as before — this never forces
--                                     every org through scheduling)
--   pending_approval / approved / scheduled -> cancelled
--
-- Overdue is deliberately NOT a stored state here — it's a derived
-- property of due_date and status (approved/scheduled and past due),
-- computed wherever bills render, the same reasoning
-- statutory_remittance_tracking used for why reversal-vs-remitted
-- isn't a stored flag either: a derived fact drifts the moment you
-- store it separately from what it's derived from.
alter table public.vendor_bills
  add column if not exists scheduled_payment_date date,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users (id),
  add column if not exists cancellation_reason text;

alter table public.vendor_bills drop constraint if exists vendor_bills_status_check;
alter table public.vendor_bills add constraint vendor_bills_status_check
  check (status in ('pending_approval', 'approved', 'scheduled', 'paid', 'rejected', 'cancelled'));

-- schedule_vendor_bill_payment: security invoker, same as every other
-- vendor_bills lifecycle function — relies on the existing "admins and
-- payroll managers can update vendor bills" RLS policy rather than a
-- redundant explicit role check.
create or replace function public.schedule_vendor_bill_payment(p_bill_id uuid, p_payment_date date)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
begin
  if p_payment_date is null then
    raise exception 'A payment date is required';
  end if;

  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status <> 'approved' then
    raise exception 'Bill % is not approved (status: %)', p_bill_id, v_bill.status;
  end if;

  update public.vendor_bills
  set status = 'scheduled', scheduled_payment_date = p_payment_date
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.schedule_vendor_bill_payment(uuid, date) from public;
grant execute on function public.schedule_vendor_bill_payment(uuid, date) to authenticated;

-- pay_vendor_bill: full redeclare of 20260811010000's version, widened
-- to accept a 'scheduled' bill as well as 'approved' — scheduling is an
-- optional waypoint, not a required gate, so paying an approved bill
-- directly (skipping scheduling entirely) still works exactly as
-- before. The WHT-split posting logic is unchanged.
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
  if v_bill.status not in ('approved', 'scheduled') then
    raise exception 'Bill % is not approved or scheduled for payment (status: %)', p_bill_id, v_bill.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_bill.org_id, 'Vendor bill paid: ' || v_bill.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, v_bill.org_id, 'accounts_payable', 'debit', v_bill.amount_kobo);

  if v_bill.wht_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, v_bill.org_id, 'cash_and_bank', 'credit', v_bill.net_payable_kobo),
      (v_journal_entry_id, v_bill.org_id, 'wht_payable', 'credit', v_bill.wht_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_bill.org_id, 'cash_and_bank', 'credit', v_bill.amount_kobo);
  end if;

  update public.vendor_bills
  set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

-- pay_vendor_bills_batch: full redeclare of 20260811010000's version,
-- same 'approved' + 'scheduled' widening applied to the batch match.
create or replace function public.pay_vendor_bills_batch(p_org_id uuid, p_bill_ids uuid[])
returns setof public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested_count int := coalesce(array_length(p_bill_ids, 1), 0);
  v_matched_count int;
  v_total_kobo bigint;
  v_total_wht_kobo bigint;
  v_journal_entry_id uuid;
begin
  if v_requested_count = 0 then
    raise exception 'Select at least one bill to pay';
  end if;

  select count(*), coalesce(sum(amount_kobo), 0), coalesce(sum(wht_kobo), 0)
    into v_matched_count, v_total_kobo, v_total_wht_kobo
  from public.vendor_bills
  where id = any(p_bill_ids) and org_id = p_org_id and status in ('approved', 'scheduled');

  if v_matched_count <> v_requested_count then
    raise exception 'One or more bills are not approved or scheduled, do not belong to this organization, or you do not have permission to pay them';
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (p_org_id, 'Batch payment: ' || v_matched_count || ' vendor bill(s)', current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, p_org_id, 'accounts_payable', 'debit', v_total_kobo);

  if v_total_wht_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, p_org_id, 'cash_and_bank', 'credit', v_total_kobo - v_total_wht_kobo),
      (v_journal_entry_id, p_org_id, 'wht_payable', 'credit', v_total_wht_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, p_org_id, 'cash_and_bank', 'credit', v_total_kobo);
  end if;

  return query
    update public.vendor_bills
    set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
    where id = any(p_bill_ids) and org_id = p_org_id
    returning *;
end;
$$;

revoke all on function public.pay_vendor_bill(uuid) from public;
revoke all on function public.pay_vendor_bills_batch(uuid, uuid[]) from public;
grant execute on function public.pay_vendor_bill(uuid) to authenticated;
grant execute on function public.pay_vendor_bills_batch(uuid, uuid[]) to authenticated;

-- cancel_vendor_bill: allowed from pending_approval, approved, or
-- scheduled — never from paid (money already moved; that's a
-- reversal/refund question this doesn't attempt) or an already-
-- rejected/cancelled bill. A pending_approval bill never posted a
-- journal entry, so there's nothing to reverse. An approved or
-- scheduled bill DID post one (approve_vendor_bill's expense/AP
-- entry) — cancelling it posts a correcting entry with every original
-- posting re-inserted at flipped direction, the exact same pattern
-- reverse_pay_run uses for payroll: the original entry is kept exactly
-- as posted, never edited, and the correction is a new, separate entry.
create or replace function public.cancel_vendor_bill(p_bill_id uuid, p_reason text)
returns public.vendor_bills
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_reversal_journal_entry_id uuid;
  v_orig_posting record;
begin
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to cancel a bill';
  end if;

  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if v_bill.status not in ('pending_approval', 'approved', 'scheduled') then
    raise exception 'Bill % cannot be cancelled from its current status (%)', p_bill_id, v_bill.status;
  end if;

  if v_bill.journal_entry_id is not null then
    insert into public.journal_entries (org_id, memo, entry_date)
    values (v_bill.org_id, 'Vendor bill cancelled: ' || v_bill.description || ' — ' || p_reason, current_date)
    returning id into v_reversal_journal_entry_id;

    for v_orig_posting in
      select account_code, direction, amount_kobo
      from public.ledger_postings
      where journal_entry_id = v_bill.journal_entry_id
    loop
      insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
      values (
        v_reversal_journal_entry_id,
        v_bill.org_id,
        v_orig_posting.account_code,
        case when v_orig_posting.direction = 'debit' then 'credit' else 'debit' end,
        v_orig_posting.amount_kobo
      );
    end loop;
  end if;

  update public.vendor_bills
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.cancel_vendor_bill(uuid, text) from public;
grant execute on function public.cancel_vendor_bill(uuid, text) to authenticated;
