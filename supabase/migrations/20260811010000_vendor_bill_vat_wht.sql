-- Wire VAT and WHT into vendor bills (feature-map gap: the compliance
-- engine's VAT/WHT calculators — packages/compliance/src/schemes/vat.ts,
-- wht.ts — have had a versioned, tested rate table since the last two
-- PRs, but nothing in the product actually computed or stored a
-- breakdown against a real bill. This closes that gap for
-- manually-raised bills.
--
-- amount_kobo keeps its existing meaning (the total bill amount posted
-- as the Accounts Payable liability) — it's now understood as VAT-
-- inclusive (subtotal + VAT), same as before this migration for any
-- bill a user typed a single all-in figure for. subtotal_kobo and
-- net_payable_kobo are new: subtotal_kobo is the VAT-exclusive base
-- (what computeVendorInvoiceTotals took as input), net_payable_kobo is
-- what actually gets disbursed to the vendor after withholding
-- (amount_kobo - wht_kobo). This choice avoids touching every existing
-- read of amount_kobo (CSV export, ApprovedBillsTable, the settled-
-- bills table, the general ledger) — they keep meaning exactly what
-- they already mean.
--
-- vat_category/wht_category/rule_version_id are left nullable rather
-- than backfilled for existing rows: those bills were never computed
-- against a rule version, and assigning one after the fact would
-- misrepresent the audit trail. subtotal_kobo/net_payable_kobo ARE
-- backfilled to amount_kobo for existing rows (no VAT, no WHT was ever
-- computed for them, so subtotal = total and nothing was withheld) and
-- then made NOT NULL, since every row (old or new) has a definite value
-- for those two, whereas the category/rule-version columns for old rows
-- are honestly "not applicable" rather than any specific value.
--
-- VAT input is not tracked as its own recoverable-asset ledger line in
-- this pass — it's posted as part of the expense debit at approval,
-- same 2-leg approve_vendor_bill posting as before, unchanged. That's a
-- disclosed simplification (VAT input-credit accounting is materially
-- more involved and out of scope here), not an oversight.
--
-- Recurring bills (vendor_bill_templates / generate_recurring_vendor_bills)
-- deliberately do NOT gain VAT/WHT category fields in this pass: rate
-- computation lives in packages/compliance (TypeScript), and the cron
-- job that generates recurring bills runs in pure SQL with no app-layer
-- involvement — duplicating the rate table in PL/pgSQL would drift from
-- the single source of truth the whole compliance engine is built
-- around. Auto-generated bills keep posting flat, exactly as before;
-- only bills raised through the UI compute a real VAT/WHT breakdown.
--
-- Idempotent throughout, matching every migration since 20260730010000:
-- this project's operator applies migrations by hand in the SQL Editor.
alter table public.vendor_bills
  add column if not exists subtotal_kobo bigint check (subtotal_kobo >= 0),
  add column if not exists vat_category text,
  add column if not exists vat_kobo bigint not null default 0 check (vat_kobo >= 0),
  add column if not exists vat_exempt boolean not null default false,
  add column if not exists wht_category text,
  add column if not exists wht_kobo bigint not null default 0 check (wht_kobo >= 0),
  add column if not exists net_payable_kobo bigint check (net_payable_kobo >= 0),
  add column if not exists rule_version_id text;

update public.vendor_bills
set subtotal_kobo = amount_kobo, net_payable_kobo = amount_kobo
where subtotal_kobo is null;

alter table public.vendor_bills
  alter column subtotal_kobo set not null,
  alter column net_payable_kobo set not null;

-- New system liability account, matching the exact two-place seeding
-- pattern 20260730020000 established: backfill every existing org's
-- chart, then add it to create_organization()'s own seed list so a
-- brand-new org gets it too.
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, 'wht_payable', 'WHT payable (due FIRS/State IRS, by the 21st)', 'liability', true
from public.organizations o
on conflict (org_id, code) do nothing;

create or replace function public.create_organization(
  p_name text,
  p_rc_number text default null,
  p_company_tin text default null,
  p_default_pay_frequency text default 'monthly',
  p_default_pfa text default null,
  p_states_of_operation text[] default '{}'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, rc_number, company_tin, default_pay_frequency, default_pfa, states_of_operation)
  values (p_name, p_rc_number, p_company_tin, p_default_pay_frequency, p_default_pfa, p_states_of_operation)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  insert into public.chart_of_accounts (org_id, code, name, type, is_system)
  values
    (v_org.id, 'payroll_expense', 'Payroll expense', 'expense', true),
    (v_org.id, 'expense_reimbursement_expense', 'Expense reimbursement expense', 'expense', true),
    (v_org.id, 'overtime_pay_expense', 'Overtime pay expense', 'expense', true),
    (v_org.id, 'thirteenth_month_expense', '13th month expense', 'expense', true),
    (v_org.id, 'bonus_expense', 'Bonus expense', 'expense', true),
    (v_org.id, 'arrears_expense', 'Arrears expense', 'expense', true),
    (v_org.id, 'employer_pension_expense', 'Employer pension expense', 'expense', true),
    (v_org.id, 'benefits_expense', 'Benefits expense', 'expense', true),
    (v_org.id, 'leave_payout_expense', 'Leave payout expense (final settlement)', 'expense', true),
    (v_org.id, 'gratuity_expense', 'Gratuity expense (final settlement)', 'expense', true),
    (v_org.id, 'nsitf_expense', 'NSITF expense', 'expense', true),
    (v_org.id, 'vendor_expense', 'Vendor expense', 'expense', true),
    (v_org.id, 'net_pay_payable', 'Net pay payable', 'liability', true),
    (v_org.id, 'paye_payable', 'PAYE payable (due FIRS/state IRS, before the 10th)', 'liability', true),
    (v_org.id, 'pension_payable', 'Pension payable (due PFA, before the 7th)', 'liability', true),
    (v_org.id, 'nhf_payable', 'NHF payable (due FMBN, before the 10th)', 'liability', true),
    (v_org.id, 'benefits_payable', 'Benefits payable', 'liability', true),
    (v_org.id, 'nsitf_payable', 'NSITF payable (due NSITF, before the 16th)', 'liability', true),
    (v_org.id, 'accounts_payable', 'Accounts payable', 'liability', true),
    (v_org.id, 'wht_payable', 'WHT payable (due FIRS/State IRS, by the 21st)', 'liability', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;

-- pay_vendor_bill: full redeclare of 20260730010000's function. Splits
-- the cash leg from the WHT leg whenever the bill actually withheld
-- something (wht_kobo > 0) — ledger_postings.amount_kobo has a strict
-- > 0 check, so a bill with no WHT (every bill raised before this
-- migration, or one where the payer chose a 0-rate category, though
-- none exist in the current rule version) posts the original 2-leg
-- entry unchanged rather than attempting a zero-amount WHT posting.
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

-- pay_vendor_bills_batch: full redeclare of 20260801030000's function,
-- same split applied to the batch's aggregate totals.
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
  where id = any(p_bill_ids) and org_id = p_org_id and status = 'approved';

  if v_matched_count <> v_requested_count then
    raise exception 'One or more bills are not approved, do not belong to this organization, or you do not have permission to pay them';
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

-- generate_recurring_vendor_bills: full redeclare of 20260801020000's
-- function, setting subtotal_kobo/net_payable_kobo to the template's
-- flat amount_kobo (vat_kobo/wht_kobo keep their column defaults of 0)
-- — see the module comment above for why recurring bills don't compute
-- a real VAT/WHT breakdown.
create or replace function core.generate_recurring_vendor_bills()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_template record;
  v_next_date date;
begin
  for v_template in
    select * from public.vendor_bill_templates
    where active = true and next_bill_date <= current_date
  loop
    insert into public.vendor_bills (
      org_id, vendor_id, bill_date, amount_kobo, subtotal_kobo, net_payable_kobo, description, status, requested_by
    )
    values (
      v_template.org_id,
      v_template.vendor_id,
      v_template.next_bill_date,
      v_template.amount_kobo,
      v_template.amount_kobo,
      v_template.amount_kobo,
      v_template.description,
      'pending_approval',
      v_template.created_by
    );

    v_next_date := (case v_template.cadence
      when 'weekly' then v_template.next_bill_date + interval '7 days'
      when 'monthly' then v_template.next_bill_date + interval '1 month'
      when 'quarterly' then v_template.next_bill_date + interval '3 months'
      when 'annually' then v_template.next_bill_date + interval '1 year'
      else v_template.next_bill_date + interval '1 month'
    end)::date;

    update public.vendor_bill_templates set next_bill_date = v_next_date where id = v_template.id;
  end loop;
end;
$$;

revoke execute on function core.generate_recurring_vendor_bills() from public, anon, authenticated;
