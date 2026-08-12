-- Closes the gap 20260812010001's own comment disclosed: "ITF and WHT
-- are left out of the reminder — both are 'documented, not yet applied'
-- on /compliance, so nothing in this build produces the data a real
-- reminder for either would need."
--
-- WHT is actually a documentation bug, not a real gap — /compliance
-- already marks it "Applied in vendor bills" (computeWht via
-- computeVendorInvoiceTotals, wired up in 20260811010000), and every
-- paid bill's withheld amount already posts to wht_payable. Nothing
-- needed here except pointing the reminder at that existing data.
--
-- ITF is the real gap: computeItf() has existed in packages/compliance
-- since the same PR as computeWht, but nothing in the product ever
-- called it — no UI captured the org turnover/headcount input it needs,
-- and nothing posted a liability for it. This migration adds the
-- missing piece: an admin-triggered annual assessment (the same
-- "manually triggered, period-based run" shape depreciation_runs already
-- uses), computed in the app layer via computeItf() — never
-- reimplemented in SQL, per the compliance engine's "rules are data,
-- never duplicated into a second calculation path" discipline — and
-- recorded here.
insert into public.chart_of_accounts (org_id, code, name, type, is_system)
select o.id, accounts.code, accounts.name, accounts.type, true
from public.organizations o
cross join (values
  ('itf_expense', 'ITF expense', 'expense'),
  ('itf_payable', 'ITF payable (due ITF, on/before 1 April annually)', 'liability')
) as accounts(code, name, type)
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
    (v_org.id, 'itf_expense', 'ITF expense', 'expense', true),
    (v_org.id, 'net_pay_payable', 'Net pay payable', 'liability', true),
    (v_org.id, 'paye_payable', 'PAYE payable (due FIRS/state IRS, before the 10th)', 'liability', true),
    (v_org.id, 'pension_payable', 'Pension payable (due PFA, before the 7th)', 'liability', true),
    (v_org.id, 'nhf_payable', 'NHF payable (due FMBN, before the 10th)', 'liability', true),
    (v_org.id, 'benefits_payable', 'Benefits payable', 'liability', true),
    (v_org.id, 'nsitf_payable', 'NSITF payable (due NSITF, before the 16th)', 'liability', true),
    (v_org.id, 'accounts_payable', 'Accounts payable', 'liability', true),
    (v_org.id, 'wht_payable', 'WHT payable (due FIRS/State IRS, by the 21st)', 'liability', true),
    (v_org.id, 'itf_payable', 'ITF payable (due ITF, on/before 1 April annually)', 'liability', true),
    (v_org.id, 'staff_loans_receivable', 'Staff loans receivable', 'asset', true),
    (v_org.id, 'cash_and_bank', 'Cash and bank', 'asset', true);

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;

-- One row per org per assessed calendar year — mirrors depreciation_runs'
-- "one period, one run" shape, including the same database-level guard
-- against double-running (unique constraint, not just an app-side check).
-- annual_turnover_kobo and employee_count are captured as of the
-- assessment, not read live off organizations/employees later — an
-- assessment is a point-in-time statutory determination and must stay
-- reproducible even if headcount or a later-corrected turnover figure
-- changes afterward.
create table public.itf_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  assessment_year integer not null check (assessment_year >= 2000),
  annual_payroll_base_kobo bigint not null check (annual_payroll_base_kobo >= 0),
  employee_count integer not null check (employee_count >= 0),
  annual_turnover_kobo bigint not null check (annual_turnover_kobo >= 0),
  qualifies boolean not null,
  employer_kobo bigint not null check (employer_kobo >= 0),
  rule_version_id text not null,
  journal_entry_id uuid references public.journal_entries (id),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (org_id, assessment_year)
);

create index itf_assessments_org_id_idx on public.itf_assessments (org_id);

alter table public.itf_assessments enable row level security;

create policy "finance and accounting roles can view itf assessments"
on public.itf_assessments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant', 'finance_manager', 'auditor']));

-- No direct-insert RLS policy — every write goes through
-- record_itf_assessment() below (security definer, its own explicit role
-- check), the same "no client-side insert escape hatch" shape
-- depreciation_runs' own posting function uses for the ledger entry it
-- creates alongside the run.

-- Takes every figure already computed in the app layer via computeItf()
-- (packages/compliance) — this function only records and, if the org
-- qualifies with a nonzero liability, posts the balanced journal entry.
-- It never re-derives the 1% rate or the qualifying threshold itself;
-- duplicating those into SQL would create a second, driftable copy of a
-- versioned statutory figure, exactly what this engine's whole design
-- exists to avoid.
create or replace function public.record_itf_assessment(
  p_org_id uuid,
  p_assessment_year integer,
  p_annual_payroll_base_kobo bigint,
  p_employee_count integer,
  p_annual_turnover_kobo bigint,
  p_qualifies boolean,
  p_employer_kobo bigint,
  p_rule_version_id text
)
returns public.itf_assessments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.itf_assessments;
  v_journal_entry_id uuid;
begin
  if not core.has_org_role(p_org_id, array['admin', 'payroll_manager', 'finance_manager']) then
    raise exception 'You do not have permission to run an ITF assessment for this organization';
  end if;

  if exists (
    select 1 from public.itf_assessments
    where org_id = p_org_id and assessment_year = p_assessment_year
  ) then
    raise exception 'An ITF assessment for % has already been run for this organization', p_assessment_year;
  end if;

  if p_qualifies and p_employer_kobo > 0 then
    insert into public.journal_entries (org_id, memo, entry_date)
    values (p_org_id, 'ITF assessment ' || p_assessment_year, current_date)
    returning id into v_journal_entry_id;

    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, p_org_id, 'itf_expense', 'debit', p_employer_kobo),
      (v_journal_entry_id, p_org_id, 'itf_payable', 'credit', p_employer_kobo);
  end if;

  insert into public.itf_assessments (
    org_id, assessment_year, annual_payroll_base_kobo, employee_count,
    annual_turnover_kobo, qualifies, employer_kobo, rule_version_id,
    journal_entry_id, created_by
  )
  values (
    p_org_id, p_assessment_year, p_annual_payroll_base_kobo, p_employee_count,
    p_annual_turnover_kobo, p_qualifies, p_employer_kobo, p_rule_version_id,
    v_journal_entry_id, auth.uid()
  )
  returning * into v_assessment;

  return v_assessment;
end;
$$;

revoke all on function public.record_itf_assessment(uuid, integer, bigint, integer, bigint, boolean, bigint, text) from public, anon, authenticated;
grant execute on function public.record_itf_assessment(uuid, integer, bigint, integer, bigint, boolean, bigint, text) to authenticated;

-- core.check_statutory_deadlines(): full redeclare of 20260812010001's
-- version. The original four-scheme loop (paye/pension/nhf/nsitf) is
-- unchanged; WHT and ITF are added as their own sections rather than
-- folded into that loop, since each has a genuinely different activity
-- signal and cadence:
--   - WHT: monthly like the original four, but keyed off paid vendor
--     bills (wht_kobo > 0), not pay runs — a pure-payroll org with no AP
--     activity has nothing to be reminded about here, and vice versa.
--   - ITF: annual (04-01), and its "has this org already handled it"
--     check is itf_assessments rather than a monthly notified-log —
--     reminding to *run the assessment*, not asserting a precomputed
--     liability, is deliberate: whether an org owes anything at all
--     depends on the turnover/headcount test the assessment itself
--     performs, so the reminder can honestly say "the deadline is
--     coming and you haven't assessed this year" without claiming to
--     know the answer.
create or replace function core.check_statutory_deadlines()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_window_days constant int := 5;
  v_scheme record;
  v_reminder_day int;
  v_deadline_month date;
  v_org record;
  v_recipients uuid[];
  v_itf_reminder_month int := 3; -- March: 5 days before 1 April
  v_itf_reminder_day int := 27;
  v_current_year int := extract(year from current_date)::int;
begin
  for v_scheme in
    select * from (values
      ('paye', 10, 'PAYE', 'FIRS / State IRS'),
      ('pension', 7, 'Pension', 'the PFA'),
      ('nhf', 10, 'NHF', 'FMBN'),
      ('nsitf', 16, 'NSITF', 'NSITF')
    ) as s(scheme, deadline_day, label, authority)
  loop
    v_reminder_day := v_scheme.deadline_day - v_window_days;
    if extract(day from current_date) != v_reminder_day then
      continue;
    end if;

    v_deadline_month := date_trunc('month', current_date)::date;

    for v_org in
      select distinct pr.org_id
      from public.pay_runs pr
      where pr.status = 'posted'
        and pr.period_end >= current_date - 60
        and not exists (
          select 1 from core.statutory_deadline_notified n
          where n.org_id = pr.org_id and n.scheme = v_scheme.scheme and n.deadline_month = v_deadline_month
        )
    loop
      select array_agg(user_id) into v_recipients
      from public.org_memberships
      where org_id = v_org.org_id and role in ('admin', 'payroll_manager', 'finance_manager');

      if v_recipients is not null then
        insert into public.notifications (org_id, recipient_user_id, type, message, link)
        select
          v_org.org_id,
          uid,
          'statutory_deadline_reminder',
          v_scheme.label || ' remittance due to ' || v_scheme.authority || ' by the ' || v_scheme.deadline_day || 'th — '
            || v_window_days || ' day' || (case when v_window_days = 1 then '' else 's' end) || ' left.',
          '/compliance'
        from unnest(v_recipients) as uid;
      end if;

      insert into core.statutory_deadline_notified (org_id, scheme, deadline_month)
      values (v_org.org_id, v_scheme.scheme, v_deadline_month);
    end loop;
  end loop;

  -- WHT: same monthly cadence and reminder-window arithmetic as the loop
  -- above (day 21, reusing the exact figure already on the wht_payable
  -- account label rather than inventing a new one), but the activity
  -- signal is paid vendor bills, not payroll.
  if extract(day from current_date) = 21 - v_window_days then
    v_deadline_month := date_trunc('month', current_date)::date;

    for v_org in
      select distinct vb.org_id
      from public.vendor_bills vb
      where vb.status = 'paid'
        and vb.wht_kobo > 0
        and vb.paid_at >= current_date - 60
        and not exists (
          select 1 from core.statutory_deadline_notified n
          where n.org_id = vb.org_id and n.scheme = 'wht' and n.deadline_month = v_deadline_month
        )
    loop
      select array_agg(user_id) into v_recipients
      from public.org_memberships
      where org_id = v_org.org_id and role in ('admin', 'payroll_manager', 'finance_manager');

      if v_recipients is not null then
        insert into public.notifications (org_id, recipient_user_id, type, message, link)
        select
          v_org.org_id,
          uid,
          'statutory_deadline_reminder',
          'WHT remittance due to FIRS/State IRS by the 21st — ' || v_window_days || ' days left.',
          '/compliance'
        from unnest(v_recipients) as uid;
      end if;

      insert into core.statutory_deadline_notified (org_id, scheme, deadline_month)
      values (v_org.org_id, 'wht', v_deadline_month);
    end loop;
  end if;

  -- ITF: annual, reminding to run the assessment rather than asserting a
  -- precomputed amount — see the function-level comment above for why.
  if extract(month from current_date) = v_itf_reminder_month and extract(day from current_date) = v_itf_reminder_day then
    for v_org in
      select distinct pr.org_id
      from public.pay_runs pr
      where pr.status = 'posted'
        and pr.period_start >= make_date(v_current_year, 1, 1)
        and pr.period_end <= make_date(v_current_year, 12, 31)
        and not exists (
          select 1 from public.itf_assessments ia
          where ia.org_id = pr.org_id and ia.assessment_year = v_current_year
        )
    loop
      select array_agg(user_id) into v_recipients
      from public.org_memberships
      where org_id = v_org.org_id and role in ('admin', 'payroll_manager', 'finance_manager');

      if v_recipients is not null then
        insert into public.notifications (org_id, recipient_user_id, type, message, link)
        select
          v_org.org_id,
          uid,
          'statutory_deadline_reminder',
          'ITF remittance due to ITF on/before 1 April — run this year''s ITF assessment from Compliance if you haven''t yet.',
          '/compliance'
        from unnest(v_recipients) as uid;
      end if;

      insert into core.statutory_deadline_notified (org_id, scheme, deadline_month)
      values (v_org.org_id, 'itf', make_date(v_current_year, 4, 1));
    end loop;
  end if;
end;
$$;

revoke execute on function core.check_statutory_deadlines() from public, anon, authenticated;
