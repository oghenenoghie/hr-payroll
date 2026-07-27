-- Turns Payroll Simulation from purely observational into something you
-- can actually act on: the org-wide raise slider already recomputes real
-- statutory cost impact against real active employees through the real
-- compliance engine (computePension/computeNhf/computeAnnualPaye), but
-- there was previously no path from "here's what this would cost" to
-- actually applying it. apply_org_wide_raise scales every active
-- employee's basic/housing/transport by the same multiplier the
-- simulation UI shows, in one transaction.
--
-- Reuses the existing employee_compensation_history trigger unchanged —
-- log_employee_compensation_change_trigger fires per-row on this bulk
-- UPDATE exactly the same way it does for a single employee edit, so
-- every employee's old/new figures land in the audit trail with no new
-- logging code, and the next pay run's mid-period proration correctly
-- treats "today" as the split boundary if a run happens to span it.
--
-- Admin-only — a higher bar than pay-run creation (admin/payroll_manager),
-- matching reverse_pay_run's precedent: this changes every active
-- employee's contractual pay in one action, more consequential than any
-- single pay run.
create or replace function public.apply_org_wide_raise(p_org_id uuid, p_raise_percent numeric)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not core.has_org_role(p_org_id, array['admin']) then
    raise exception 'You do not have permission to apply an org-wide raise for this organization';
  end if;

  if p_raise_percent is null or p_raise_percent <= 0 or p_raise_percent > 50 then
    raise exception 'Raise percent must be greater than 0 and at most 50';
  end if;

  update public.employees
  set
    basic_kobo = round(basic_kobo * (1 + p_raise_percent / 100.0)),
    housing_kobo = round(housing_kobo * (1 + p_raise_percent / 100.0)),
    transport_kobo = round(transport_kobo * (1 + p_raise_percent / 100.0))
  where org_id = p_org_id and status = 'active';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.apply_org_wide_raise(uuid, numeric) from public;
grant execute on function public.apply_org_wide_raise(uuid, numeric) to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'leave_request_submitted',
  'leave_request_approved',
  'leave_request_rejected',
  'loan_request_submitted',
  'loan_approved',
  'loan_rejected',
  'expense_submitted',
  'expense_approved',
  'expense_rejected',
  'benefit_enrolled',
  'pay_run_created',
  'overtime_request_submitted',
  'overtime_approved',
  'overtime_rejected',
  'leave_encashment_submitted',
  'leave_encashment_approved',
  'leave_encashment_rejected',
  'policy_published',
  'contract_expiring',
  'probation_ending',
  'approval_pending_reminder',
  'compensation_updated'
));
