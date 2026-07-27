-- Draft -> posted pay-run state model — feature-backlog.md's biggest
-- remaining correctness gap: pay-run creation has been immediate/atomic
-- since day one, so a variance-flagged run (see 20260725... payroll
-- variance detection) had no gate to stop it before it posted —
-- reversal was the only way to correct it after the fact.
--
-- Scoped deliberately to the regular create_pay_run path (weekly/biweekly/
-- monthly/thirteenth_month/bonus, created via payroll/new). Final
-- Settlement calls this same RPC but never passes payload.status, so it
-- keeps posting immediately exactly as before — a settlement's
-- final_settlements row is an eligibility-blocking "this employee has
-- been settled" marker, and having it exist for a still-discardable draft
-- would leave the app in an inconsistent state. Extending the same gate
-- to settlements is a reasonable follow-up, not bundled in here.
--
-- Side effects (loan repayments, expense/leave/attendance/overtime/
-- encashment consumption) still apply immediately at draft-creation time,
-- same as today's atomic writer — deferring them to approval time would
-- need a second computation pass and a place to stash the deferred
-- payload, which is real complexity for a benefit no one asked for here.
-- Instead, discarding a draft explicitly restores every one of those six
-- categories before deleting the run, which is what makes "discard" a
-- true no-op rather than reversal's disclosed partial undo.
alter table public.pay_runs drop constraint pay_runs_status_check;
alter table public.pay_runs add constraint pay_runs_status_check
  check (status = any (array['draft', 'posted', 'reversed']));

alter table public.pay_runs
  add column approved_by uuid references auth.users (id),
  add column approved_at timestamptz;

-- Full redeclare (same atomic-writer pattern as every prior extension of
-- this function) — the only change is the new optional payload.status
-- key, defaulting to 'posted' so every existing caller (Final Settlement)
-- is unaffected without touching its call site.
create or replace function public.create_pay_run(payload jsonb)
 returns pay_runs
 language plpgsql
 security definer
 set search_path to ''
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
  if not core.has_org_role(v_org_id, array['admin', 'payroll_manager']) then
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
      salary_change_adjustment_kobo
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
      coalesce((v_employee->>'salary_change_adjustment_kobo')::bigint, 0)
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

  return v_pay_run;
end;
$function$;

-- Approve a draft: flips it live. Nothing else needs to change — every
-- payslip, posting and side effect was already written correctly at
-- draft-creation time, so approval is just removing the gate.
create or replace function public.approve_pay_run(p_pay_run_id uuid)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to approve a pay run for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be approved';
  end if;

  update public.pay_runs
  set status = 'posted', approved_by = auth.uid(), approved_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.approve_pay_run(uuid) from public;
grant execute on function public.approve_pay_run(uuid) to authenticated;

-- Discard a draft: the true no-op reversal never got — restores every
-- side effect this draft applied (loan balances, expense/leave/
-- attendance/overtime/encashment consumption) before deleting its
-- journal entries (cascades ledger_postings) and finally the pay_runs row
-- itself (cascades payslips and loan_repayments — read before this,
-- never after).
create or replace function public.discard_pay_run_draft(p_pay_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to discard a pay run draft for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be discarded';
  end if;

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

  delete from public.journal_entries where pay_run_id = p_pay_run_id;
  delete from public.pay_runs where id = p_pay_run_id;
end;
$$;

revoke all on function public.discard_pay_run_draft(uuid) from public;
grant execute on function public.discard_pay_run_draft(uuid) to authenticated;

-- Read-side helper so every report/self-service/carry-forward query that
-- reads payslips across runs doesn't have to remember to exclude drafts
-- itself — a draft's numbers aren't final until approved, so nothing
-- outside the review page itself should ever see them. Not RLS'd
-- separately: security_invoker means it runs under the querying user's
-- own payslips/pay_runs policies, same as employees_masked.
create view public.posted_payslips
with (security_invoker = true)
as
select p.*
from public.payslips p
join public.pay_runs r on r.id = p.pay_run_id
where r.status != 'draft';
