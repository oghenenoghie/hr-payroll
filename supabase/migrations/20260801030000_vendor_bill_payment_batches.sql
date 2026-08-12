-- Payment batches (feature-map gap: "no payment batches") — pay several
-- approved vendor bills together in one action instead of one at a time.
-- Mirrors how a pay run posts a single aggregate entry rather than one
-- per employee: one journal entry for the whole batch (debit Accounts
-- Payable, credit Cash & Bank for the combined total), with every bill in
-- the batch sharing that same payment_journal_entry_id — the column was
-- already a plain nullable FK, not unique, so many bills pointing at one
-- journal entry needed no schema change.
--
-- security invoker, matching approve_vendor_bill/pay_vendor_bill exactly:
-- every insert and update below still goes through the existing RLS
-- policies for whoever calls it (journal_entries/ledger_postings inserts
-- require admin/payroll_manager per 20260722170042_ledger.sql; the
-- vendor_bills update requires the same), so this grants no privilege
-- beyond what the caller's role already has.
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
  v_journal_entry_id uuid;
begin
  if v_requested_count = 0 then
    raise exception 'Select at least one bill to pay';
  end if;

  select count(*), coalesce(sum(amount_kobo), 0)
    into v_matched_count, v_total_kobo
  from public.vendor_bills
  where id = any(p_bill_ids) and org_id = p_org_id and status = 'approved';

  if v_matched_count <> v_requested_count then
    raise exception 'One or more bills are not approved, do not belong to this organization, or you do not have permission to pay them';
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (p_org_id, 'Batch payment: ' || v_matched_count || ' vendor bill(s)', current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, p_org_id, 'accounts_payable', 'debit', v_total_kobo),
    (v_journal_entry_id, p_org_id, 'cash_and_bank', 'credit', v_total_kobo);

  return query
    update public.vendor_bills
    set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
    where id = any(p_bill_ids) and org_id = p_org_id
    returning *;
end;
$$;

revoke all on function public.pay_vendor_bills_batch(uuid, uuid[]) from public;
grant execute on function public.pay_vendor_bills_batch(uuid, uuid[]) to authenticated;
