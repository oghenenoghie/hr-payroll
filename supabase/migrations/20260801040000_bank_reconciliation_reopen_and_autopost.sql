-- Two Bank & Cash Reconciliation gaps closed together: reopening a
-- completed reconciliation, and turning a discovered bank-only item (a
-- fee, interest) directly into a posted journal entry instead of making
-- someone book it by hand elsewhere first.
--
-- Idempotent throughout (CREATE OR REPLACE / ON CONFLICT DO NOTHING),
-- matching every migration since 20260730010000: this project's operator
-- applies migrations by hand in the SQL Editor.

-- Reopen: a completed reconciliation is a control record, not a journal
-- entry — reopening it doesn't touch the ledger at all, just flips the
-- status back so matching/unmatching is possible again, clearing the
-- completed_by/completed_at attestation since it's no longer true.
-- security invoker, same as every other atomic function in this build —
-- the existing "admins and payroll managers can update reconciliations"
-- policy is what actually gates who can call this.
create or replace function public.reopen_bank_reconciliation(p_reconciliation_id uuid)
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
  if v_reconciliation.status <> 'completed' then
    raise exception 'Reconciliation % is not completed (status: %)', p_reconciliation_id, v_reconciliation.status;
  end if;

  update public.bank_reconciliations
  set status = 'in_progress', completed_by = null, completed_at = null
  where id = p_reconciliation_id
  returning * into v_reconciliation;

  return v_reconciliation;
end;
$$;

revoke all on function public.reopen_bank_reconciliation(uuid) from public;
grant execute on function public.reopen_bank_reconciliation(uuid) to authenticated;

-- Two new system accounts the posting below relies on, seeded for every
-- org that already exists (same backfill pattern every prior accounting
-- migration has used).
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, a.code, a.name, a.type, true
from public.organizations o
cross join (
  values
    ('bank_fees_expense', 'Bank fees expense', 'expense'),
    ('bank_interest_income', 'Bank interest income', 'revenue')
) as a(code, name, type)
on conflict (org_id, code) do nothing;

-- Auto-post: a statement line the bank shows but the books don't yet
-- (a fee taken, interest paid) becomes a real balanced journal entry
-- against cash_and_bank and whichever account the caller chooses —
-- p_account_code is deliberately open text, not constrained to the two
-- seeded accounts above, matching how approve_vendor_bill's
-- p_expense_account_code already works: the chart of accounts is the
-- editable reference, never a hard-enforced foreign key from a posting
-- path. The line is matched to the cash_and_bank leg of the new entry
-- immediately, exactly like match_bank_statement_line already does, so
-- it moves off "unmatched" without a second manual step.
create or replace function public.post_bank_statement_item(p_line_id uuid, p_account_code text)
returns public.bank_statement_lines
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_line public.bank_statement_lines;
  v_reconciliation public.bank_reconciliations;
  v_journal_entry_id uuid;
  v_cash_posting_id uuid;
begin
  select * into v_line from public.bank_statement_lines where id = p_line_id for update;
  if v_line.id is null then
    raise exception 'Statement line % not found', p_line_id;
  end if;
  if v_line.matched_posting_id is not null then
    raise exception 'Statement line % is already matched', p_line_id;
  end if;

  select * into v_reconciliation from public.bank_reconciliations where id = v_line.reconciliation_id;
  if v_reconciliation.status <> 'in_progress' then
    raise exception 'Reconciliation % is not in progress (status: %)', v_reconciliation.id, v_reconciliation.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_line.org_id, 'Bank statement item: ' || v_line.description, v_line.line_date)
  returning id into v_journal_entry_id;

  -- A deposit (interest earned) debits cash and credits the chosen
  -- revenue account; a withdrawal (a fee) debits the chosen expense
  -- account and credits cash — the same debit/deposit, credit/withdrawal
  -- convention every other cash_and_bank posting in this build follows.
  if v_line.type = 'deposit' then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_line.org_id, 'cash_and_bank', 'debit', v_line.amount_kobo)
    returning id into v_cash_posting_id;
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_line.org_id, p_account_code, 'credit', v_line.amount_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_line.org_id, p_account_code, 'debit', v_line.amount_kobo);
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_line.org_id, 'cash_and_bank', 'credit', v_line.amount_kobo)
    returning id into v_cash_posting_id;
  end if;

  update public.bank_statement_lines
  set matched_posting_id = v_cash_posting_id, matched_at = now(), matched_by = auth.uid()
  where id = p_line_id
  returning * into v_line;

  return v_line;
end;
$$;

revoke all on function public.post_bank_statement_item(uuid, text) from public;
grant execute on function public.post_bank_statement_item(uuid, text) to authenticated;

-- Atomic org bootstrap — republished again to seed the two new accounts
-- above, so a brand-new org's chart is complete from creation rather than
-- needing this migration's backfill insert to catch up later.
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
    (v_org.id, 'accounts_receivable', 'Accounts receivable', 'asset', true),
    (v_org.id, 'sales_revenue', 'Sales revenue', 'revenue', true),
    (v_org.id, 'fixed_assets', 'Fixed assets (cost)', 'asset', true),
    (v_org.id, 'accumulated_depreciation', 'Accumulated depreciation (contra-asset)', 'asset', true),
    (v_org.id, 'depreciation_expense', 'Depreciation expense', 'expense', true),
    (v_org.id, 'disposal_gain_loss', 'Gain/(loss) on disposal of fixed assets', 'revenue', true),
    (v_org.id, 'bank_fees_expense', 'Bank fees expense', 'expense', true),
    (v_org.id, 'bank_interest_income', 'Bank interest income', 'revenue', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
