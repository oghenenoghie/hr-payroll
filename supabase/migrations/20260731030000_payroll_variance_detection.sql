-- Payroll variance and anomaly detection — feature-backlog.md §3: "flag
-- month-over-month anomalies before a run is approved... catching a
-- fat-fingered salary before it's paid is worth more than reporting it
-- after." Referenced but never built: 20260727020000_pay_run_draft_
-- state.sql's own comment mentions "a variance-flagged run (see
-- 20260725... payroll variance detection)" — that migration was never
-- written. This is it, slotted into the draft->approve gate that
-- migration already built.
--
-- Scope, deliberately narrow: two checks, both against each employee's
-- most recent prior *posted* payslip (never a draft or reversed one, via
-- the existing posted_payslips view) on the immediately preceding
-- same-frequency run —
--   1. Gross pay changed by 30%+ in either direction for a given
--      employee (a disclosed threshold, not a statutory figure — same
--      "explicit tolerance" spirit as the gross-up solver's iteration
--      cap).
--   2. An employee who was paid in that prior run, is still active, but
--      is missing from this one — the "did we forget someone" case.
-- Only meaningful for regular runs (weekly/biweekly/monthly) — a bonus,
-- 13th month or arrears run isn't comparable to a "prior period" in the
-- same sense, so detection is a no-op for those frequencies.
--
-- Not built: anomalies beyond these two (e.g. a single deduction that's
-- unusually large relative to gross), per-org configurable thresholds,
-- or org-wide statistical baselining instead of a fixed percentage —
-- flagged as follow-ups, not guessed at here.
create table public.pay_run_variance_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  flag_type text not null check (flag_type in ('gross_spike', 'gross_drop', 'employee_missing')),
  detail text not null,
  acknowledged_by uuid references auth.users (id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index pay_run_variance_flags_pay_run_id_idx on public.pay_run_variance_flags (pay_run_id);
create index pay_run_variance_flags_org_id_idx on public.pay_run_variance_flags (org_id);

alter table public.pay_run_variance_flags enable row level security;

create policy "admins, payroll managers and auditors can view variance flags"
on public.pay_run_variance_flags for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant', 'auditor']));

create or replace function core.detect_pay_run_variance(p_pay_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
  v_threshold constant numeric := 0.30;
  v_payslip record;
  v_prior_gross bigint;
  v_pct_change numeric;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null or v_pay_run.frequency not in ('weekly', 'biweekly', 'monthly') then
    return;
  end if;

  for v_payslip in
    select p.employee_id, p.gross_kobo
    from public.payslips p
    where p.pay_run_id = p_pay_run_id
  loop
    select pp.gross_kobo into v_prior_gross
    from public.posted_payslips pp
    join public.pay_runs pr on pr.id = pp.pay_run_id
    where pp.employee_id = v_payslip.employee_id
      and pr.id <> p_pay_run_id
      and pr.frequency in ('weekly', 'biweekly', 'monthly')
    order by pr.period_end desc
    limit 1;

    if v_prior_gross is not null and v_prior_gross > 0 then
      v_pct_change := (v_payslip.gross_kobo - v_prior_gross)::numeric / v_prior_gross;

      if abs(v_pct_change) >= v_threshold then
        insert into public.pay_run_variance_flags (org_id, pay_run_id, employee_id, flag_type, detail)
        values (
          v_pay_run.org_id,
          p_pay_run_id,
          v_payslip.employee_id,
          case when v_pct_change > 0 then 'gross_spike' else 'gross_drop' end,
          'Gross changed by ' || round(v_pct_change * 100, 1) || '% vs the prior run (' ||
            (v_prior_gross / 100.0)::numeric(14, 2) || ' -> ' || (v_payslip.gross_kobo / 100.0)::numeric(14, 2) || ' NGN)'
        );
      end if;
    end if;

    v_prior_gross := null;
  end loop;

  insert into public.pay_run_variance_flags (org_id, pay_run_id, employee_id, flag_type, detail)
  select
    v_pay_run.org_id,
    p_pay_run_id,
    missing.employee_id,
    'employee_missing',
    missing.full_name || ' was paid in the prior run but is not included in this one.'
  from (
    select distinct pp.employee_id, e.full_name
    from public.posted_payslips pp
    join public.pay_runs pr on pr.id = pp.pay_run_id
    join public.employees e on e.id = pp.employee_id
    where pr.org_id = v_pay_run.org_id
      and pr.frequency in ('weekly', 'biweekly', 'monthly')
      and pr.period_end = (
        select max(pr2.period_end)
        from public.pay_runs pr2
        where pr2.org_id = v_pay_run.org_id
          and pr2.frequency in ('weekly', 'biweekly', 'monthly')
          and pr2.id <> p_pay_run_id
          and pr2.period_end < v_pay_run.period_end
      )
      and e.status = 'active'
      and not exists (
        select 1 from public.payslips p
        where p.pay_run_id = p_pay_run_id and p.employee_id = pp.employee_id
      )
  ) missing;
end;
$$;

revoke all on function core.detect_pay_run_variance(uuid) from public, anon, authenticated;

-- create_pay_run(): full redeclare per 20260730000000_new_org_roles.sql
-- (the last migration to touch it). Only change: calls
-- core.detect_pay_run_variance() at the end, for every run regardless
-- of status — a run created already-posted (payload.status omitted)
-- still gets flags recorded for the audit trail, they just don't block
-- anything after the fact; only approve_pay_run() below actually gates.
create or replace function public.create_pay_run(payload jsonb)
returns pay_runs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org_id uuid := (payload->>'org_id')::uuid;
  v_pay_run public.pay_runs;
  v_journal_entry_id uuid;
  v_employee jsonb;
  v_posting jsonb;
  v_repayment jsonb;
  v_expense jsonb;
  v_leave jsonb;
  v_attendance jsonb;
  v_overtime jsonb;
  v_encashment jsonb;
  v_new_outstanding bigint;
  v_paid_expense_id uuid;
  v_paid_leave_id uuid;
  v_paid_attendance_id uuid;
  v_paid_overtime_id uuid;
  v_paid_encashment_id uuid;
begin
  if not core.has_org_role(v_org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to create a pay run for this organization';
  end if;

  insert into public.pay_runs (
    org_id, period_start, period_end, frequency, rule_version_id,
    employee_count, gross_kobo, net_kobo, created_by, status
  )
  values (
    v_org_id,
    (payload->>'period_start')::date,
    (payload->>'period_end')::date,
    payload->>'frequency',
    payload->>'rule_version_id',
    (payload->>'employee_count')::integer,
    (payload->>'gross_kobo')::bigint,
    (payload->>'net_kobo')::bigint,
    auth.uid(),
    coalesce(payload->>'status', 'posted')
  )
  returning * into v_pay_run;

  insert into public.journal_entries (org_id, pay_run_id, memo, entry_date)
  values (v_org_id, v_pay_run.id, payload->>'memo', (payload->>'period_end')::date)
  returning id into v_journal_entry_id;

  for v_employee in select * from jsonb_array_elements(payload->'payslips')
  loop
    insert into public.payslips (
      pay_run_id, employee_id, org_id, gross_kobo, pensionable_kobo,
      pension_employee_kobo, pension_employer_kobo, nhf_kobo, rent_relief_kobo,
      chargeable_income_kobo, paye_kobo, employee_deductions_kobo, net_kobo,
      cumulative_chargeable_income_before_kobo, cumulative_paye_paid_before_kobo,
      taxable_reimbursement_kobo, non_taxable_reimbursement_kobo, unpaid_leave_deduction_kobo,
      benefit_employer_cost_kobo, benefit_employee_deduction_kobo, attendance_absence_deduction_kobo,
      overtime_pay_kobo, new_hire_proration_deduction_kobo, leave_encashment_kobo,
      salary_change_adjustment_kobo, arrears_note
    )
    values (
      v_pay_run.id,
      (v_employee->>'employee_id')::uuid,
      v_org_id,
      (v_employee->>'gross_kobo')::bigint,
      (v_employee->>'pensionable_kobo')::bigint,
      (v_employee->>'pension_employee_kobo')::bigint,
      (v_employee->>'pension_employer_kobo')::bigint,
      (v_employee->>'nhf_kobo')::bigint,
      (v_employee->>'rent_relief_kobo')::bigint,
      (v_employee->>'chargeable_income_kobo')::bigint,
      (v_employee->>'paye_kobo')::bigint,
      (v_employee->>'employee_deductions_kobo')::bigint,
      (v_employee->>'net_kobo')::bigint,
      (v_employee->>'cumulative_chargeable_income_before_kobo')::bigint,
      (v_employee->>'cumulative_paye_paid_before_kobo')::bigint,
      coalesce((v_employee->>'taxable_reimbursement_kobo')::bigint, 0),
      coalesce((v_employee->>'non_taxable_reimbursement_kobo')::bigint, 0),
      coalesce((v_employee->>'unpaid_leave_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'benefit_employer_cost_kobo')::bigint, 0),
      coalesce((v_employee->>'benefit_employee_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'attendance_absence_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'overtime_pay_kobo')::bigint, 0),
      coalesce((v_employee->>'new_hire_proration_deduction_kobo')::bigint, 0),
      coalesce((v_employee->>'leave_encashment_kobo')::bigint, 0),
      coalesce((v_employee->>'salary_change_adjustment_kobo')::bigint, 0),
      v_employee->>'arrears_note'
    );

    for v_posting in select * from jsonb_array_elements(v_employee->'postings')
    loop
      insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo, employee_id)
      values (
        v_journal_entry_id,
        v_org_id,
        v_posting->>'account_code',
        v_posting->>'direction',
        (v_posting->>'amount_kobo')::bigint,
        (v_employee->>'employee_id')::uuid
      );
    end loop;
  end loop;

  for v_posting in select * from jsonb_array_elements(coalesce(payload->'org_postings', '[]'::jsonb))
  loop
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo, employee_id)
    values (
      v_journal_entry_id,
      v_org_id,
      v_posting->>'account_code',
      v_posting->>'direction',
      (v_posting->>'amount_kobo')::bigint,
      null
    );
  end loop;

  for v_repayment in select * from jsonb_array_elements(coalesce(payload->'loan_repayments', '[]'::jsonb))
  loop
    update public.loans
    set
      outstanding_kobo = outstanding_kobo - (v_repayment->>'amount_kobo')::bigint,
      status = case
        when outstanding_kobo - (v_repayment->>'amount_kobo')::bigint <= 0 then 'completed'
        else status
      end
    where id = (v_repayment->>'loan_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning outstanding_kobo into v_new_outstanding;

    if v_new_outstanding is null then
      raise exception 'Loan % not found, not approved, or you do not have permission to repay it', v_repayment->>'loan_id';
    end if;

    if v_new_outstanding < 0 then
      raise exception 'Repayment of % exceeds outstanding balance for loan %', v_repayment->>'amount_kobo', v_repayment->>'loan_id';
    end if;

    insert into public.loan_repayments (loan_id, pay_run_id, org_id, employee_id, amount_kobo)
    values (
      (v_repayment->>'loan_id')::uuid,
      v_pay_run.id,
      v_org_id,
      (v_repayment->>'employee_id')::uuid,
      (v_repayment->>'amount_kobo')::bigint
    );
  end loop;

  for v_expense in select * from jsonb_array_elements(coalesce(payload->'expense_reimbursements', '[]'::jsonb))
  loop
    update public.expenses
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_expense->>'expense_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_expense_id;

    if v_paid_expense_id is null then
      raise exception 'Expense claim % not found, not approved, or you do not have permission to pay it', v_expense->>'expense_id';
    end if;
  end loop;

  for v_leave in select * from jsonb_array_elements(coalesce(payload->'leave_deductions', '[]'::jsonb))
  loop
    update public.leave_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_leave->>'leave_request_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
      and leave_type = 'unpaid'
    returning id into v_paid_leave_id;

    if v_paid_leave_id is null then
      raise exception 'Leave request % not found, not approved unpaid leave, or you do not have permission to deduct it', v_leave->>'leave_request_id';
    end if;
  end loop;

  for v_attendance in select * from jsonb_array_elements(coalesce(payload->'attendance_deductions', '[]'::jsonb))
  loop
    update public.attendance_records
    set paid_pay_run_id = v_pay_run.id
    where id = (v_attendance->>'attendance_record_id')::uuid
      and org_id = v_org_id
      and status = 'absent'
      and paid_pay_run_id is null
    returning id into v_paid_attendance_id;

    if v_paid_attendance_id is null then
      raise exception 'Attendance record % not found, not an unprocessed absence, or you do not have permission to deduct it', v_attendance->>'attendance_record_id';
    end if;
  end loop;

  for v_overtime in select * from jsonb_array_elements(coalesce(payload->'overtime_payments', '[]'::jsonb))
  loop
    update public.overtime_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_overtime->>'overtime_request_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_overtime_id;

    if v_paid_overtime_id is null then
      raise exception 'Overtime request % not found, not approved, or you do not have permission to pay it', v_overtime->>'overtime_request_id';
    end if;
  end loop;

  for v_encashment in select * from jsonb_array_elements(coalesce(payload->'leave_encashments', '[]'::jsonb))
  loop
    update public.leave_encashment_requests
    set status = 'paid', paid_pay_run_id = v_pay_run.id
    where id = (v_encashment->>'leave_encashment_id')::uuid
      and org_id = v_org_id
      and status = 'approved'
    returning id into v_paid_encashment_id;

    if v_paid_encashment_id is null then
      raise exception 'Leave encashment request % not found, not approved, or you do not have permission to pay it', v_encashment->>'leave_encashment_id';
    end if;
  end loop;

  perform core.detect_pay_run_variance(v_pay_run.id);

  return v_pay_run;
end;
$function$;

revoke all on function public.create_pay_run(jsonb) from public, anon, authenticated;
grant execute on function public.create_pay_run(jsonb) to authenticated;

-- approve_pay_run(): full redeclare per 20260730000000_new_org_roles.sql
-- (the last migration to touch it). New p_acknowledge_variance param —
-- the real gate: a draft with unacknowledged variance flags cannot be
-- approved until the reviewer either resolves what caused them or
-- explicitly passes acknowledge_variance=true, which stamps every flag
-- for this run as reviewed in the same transaction as the approval
-- itself (never silently, never separately from the decision it gates).
-- Postgres treats a changed argument list as a distinct overload, not a
-- replacement — create or replace alone would leave the old single-arg
-- version callable alongside this one, with none of the variance gate.
-- Drop it explicitly first.
drop function if exists public.approve_pay_run(uuid);

create or replace function public.approve_pay_run(p_pay_run_id uuid, p_acknowledge_variance boolean default false)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
  v_unacknowledged_count integer;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to approve a pay run for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be approved';
  end if;

  select count(*) into v_unacknowledged_count
  from public.pay_run_variance_flags
  where pay_run_id = p_pay_run_id and acknowledged_by is null;

  if v_unacknowledged_count > 0 and not p_acknowledge_variance then
    raise exception 'This run has % unreviewed variance flag(s) — review them, then approve again to acknowledge and proceed', v_unacknowledged_count;
  end if;

  if v_unacknowledged_count > 0 then
    update public.pay_run_variance_flags
    set acknowledged_by = auth.uid(), acknowledged_at = now()
    where pay_run_id = p_pay_run_id and acknowledged_by is null;
  end if;

  update public.pay_runs
  set status = 'posted', approved_by = auth.uid(), approved_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.approve_pay_run(uuid, boolean) from public;
grant execute on function public.approve_pay_run(uuid, boolean) to authenticated;
