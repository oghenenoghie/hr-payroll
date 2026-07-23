-- Same reasoning as the reimbursement columns: store the unpaid-leave
-- deduction explicitly rather than leaving it implicit in the reduced
-- gross figure, so the "· how?" derivation can show it.
alter table public.payslips
  add column unpaid_leave_deduction_kobo bigint not null default 0;

create or replace function public.create_pay_run(payload jsonb)
returns public.pay_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid := (payload->>'org_id')::uuid;
  v_pay_run public.pay_runs;
  v_journal_entry_id uuid;
  v_employee jsonb;
  v_posting jsonb;
  v_repayment jsonb;
  v_expense jsonb;
  v_leave jsonb;
  v_new_outstanding bigint;
  v_paid_expense_id uuid;
  v_paid_leave_id uuid;
begin
  insert into public.pay_runs (
    org_id, period_start, period_end, frequency, rule_version_id,
    employee_count, gross_kobo, net_kobo, created_by
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
    auth.uid()
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
      taxable_reimbursement_kobo, non_taxable_reimbursement_kobo, unpaid_leave_deduction_kobo
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
      coalesce((v_employee->>'unpaid_leave_deduction_kobo')::bigint, 0)
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

  return v_pay_run;
end;
$$;

revoke all on function public.create_pay_run(jsonb) from public;
grant execute on function public.create_pay_run(jsonb) to authenticated;
