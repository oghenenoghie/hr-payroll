-- Wires up the Auditor role for real: read-only visibility across every
-- payroll, employee-record, and accounting table, plus the security
-- audit log. Before this migration, 'auditor' existed only as a
-- roles-table row, a nav-sections default, and unused role_permissions
-- seed data — no page, Server Action, or RLS policy anywhere actually
-- checked for it (confirmed by a full-codebase audit).
--
-- Every policy below is purely additive — a brand-new "auditors can
-- view X" policy per table, never a drop/replace of an existing one —
-- matching the pattern core.is_manager_of() already established in
-- 20260723090000_manager_self_service.sql ("These policies are additive
-- ... so ... extra visibility ... without touching anyone else's
-- access"). Postgres unions multiple permissive policies for the same
-- command, so this can only ever grant auditor a new read path, never
-- narrow or change what any other role already has. Auditor is
-- deliberately never added to a single insert/update/delete policy or
-- Server Action anywhere in this migration — the role is read-only by
-- design, matching its definition ("no permission to edit, delete, or
-- modify data").
--
-- Deliberately excluded from this pass: employee_documents (raw
-- uploaded files — passports, contracts — are more sensitive than the
-- structured records below, and weren't asked for), user_nav_overrides
-- and integration_connections (neither is a financial/payroll/employee
-- record), and Security & Access member management (an access-control
-- admin surface, distinct from audit-log visibility).
--
-- Idempotent (DROP POLICY IF EXISTS / CREATE OR REPLACE), matching every
-- migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor.

drop policy if exists "auditors can view employees" on public.employees;
create policy "auditors can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view pay runs" on public.pay_runs;
create policy "auditors can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view payslips" on public.payslips;
create policy "auditors can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view journal entries" on public.journal_entries;
create policy "auditors can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view ledger postings" on public.ledger_postings;
create policy "auditors can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view loans" on public.loans;
create policy "auditors can view loans"
on public.loans for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view loan repayments" on public.loan_repayments;
create policy "auditors can view loan repayments"
on public.loan_repayments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view expenses" on public.expenses;
create policy "auditors can view expenses"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view leave requests" on public.leave_requests;
create policy "auditors can view leave requests"
on public.leave_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view final settlements" on public.final_settlements;
create policy "auditors can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view benefit enrollments" on public.employee_benefit_enrollments;
create policy "auditors can view benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view attendance records" on public.attendance_records;
create policy "auditors can view attendance records"
on public.attendance_records for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view overtime requests" on public.overtime_requests;
create policy "auditors can view overtime requests"
on public.overtime_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view pay run reversals" on public.pay_run_reversals;
create policy "auditors can view pay run reversals"
on public.pay_run_reversals for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view employee status history" on public.employee_status_history;
create policy "auditors can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view leave encashment requests" on public.leave_encashment_requests;
create policy "auditors can view leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view policy acknowledgements" on public.policy_acknowledgements;
create policy "auditors can view policy acknowledgements"
on public.policy_acknowledgements for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view offboarding checklists" on public.employee_offboarding_checklist;
create policy "auditors can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view onboarding checklists" on public.employee_onboarding_checklist;
create policy "auditors can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view compensation history" on public.employee_compensation_history;
create policy "auditors can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view vendors" on public.vendors;
create policy "auditors can view vendors"
on public.vendors for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view vendor bills" on public.vendor_bills;
create policy "auditors can view vendor bills"
on public.vendor_bills for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view recurring bills" on public.vendor_bill_templates;
create policy "auditors can view recurring bills"
on public.vendor_bill_templates for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view chart of accounts" on public.chart_of_accounts;
create policy "auditors can view chart of accounts"
on public.chart_of_accounts for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view customers" on public.customers;
create policy "auditors can view customers"
on public.customers for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view customer invoices" on public.customer_invoices;
create policy "auditors can view customer invoices"
on public.customer_invoices for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view invoice payments" on public.customer_invoice_payments;
create policy "auditors can view invoice payments"
on public.customer_invoice_payments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view credit notes" on public.customer_credit_notes;
create policy "auditors can view credit notes"
on public.customer_credit_notes for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view recurring invoices" on public.customer_invoice_templates;
create policy "auditors can view recurring invoices"
on public.customer_invoice_templates for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view reconciliations" on public.bank_reconciliations;
create policy "auditors can view reconciliations"
on public.bank_reconciliations for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view statement lines" on public.bank_statement_lines;
create policy "auditors can view statement lines"
on public.bank_statement_lines for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view fixed assets" on public.fixed_assets;
create policy "auditors can view fixed assets"
on public.fixed_assets for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view depreciation runs" on public.depreciation_runs;
create policy "auditors can view depreciation runs"
on public.depreciation_runs for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view depreciation lines" on public.depreciation_lines;
create policy "auditors can view depreciation lines"
on public.depreciation_lines for select
to authenticated
using (
  exists (
    select 1 from public.depreciation_runs r
    where r.id = depreciation_run_id
      and core.has_org_role(r.org_id, array['auditor'])
  )
);

drop policy if exists "auditors can view budgets" on public.budgets;
create policy "auditors can view budgets"
on public.budgets for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

drop policy if exists "auditors can view budget lines" on public.budget_lines;
create policy "auditors can view budget lines"
on public.budget_lines for select
to authenticated
using (
  exists (
    select 1 from public.budgets b
    where b.id = budget_id
      and core.has_org_role(b.org_id, array['auditor'])
  )
);

-- Salary masking normally hides basic/housing/transport/rent/bank
-- columns from anyone who isn't admin/payroll_manager. An auditor
-- reviewing payroll compliance needs the real figures — masking exists
-- to keep HR out of compensation data it doesn't need, not to keep an
-- auditor from the thing they're specifically here to audit — so
-- 'auditor' joins the unmask list in every branch, republishing the view
-- exactly as it stood in 20260730120000_employee_profile_photo.sql with
-- that one addition.
create or replace view public.employees_masked
with (security_invoker = true)
as
select
  e.id,
  e.org_id,
  e.full_name,
  e.email,
  e.state_of_residence,
  e.hire_date,
  e.status,
  e.tin,
  e.tin_valid_from,
  e.tin_valid_to,
  e.pfa,
  e.manager_id,
  e.user_id,
  e.linked_at,
  e.annual_leave_balance_days,
  e.created_at,
  e.salary_masked,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor'])
    then null else e.bank_account_name end as bank_account_name,
  e.department_id,
  d.name as department_name,
  e.date_of_birth,
  e.nationality,
  e.job_grade_id,
  jg.name as job_grade_name,
  e.probation_end_date,
  e.confirmed,
  e.employment_type,
  e.contract_end_date,
  e.branch_id,
  b.name as branch_name,
  e.employee_id,
  e.photo_path
from public.employees e
left join public.departments d on d.id = e.department_id
left join public.job_grades jg on jg.id = e.job_grade_id
left join public.branches b on b.id = e.branch_id;

revoke all on public.employees_masked from public, anon;
grant select on public.employees_masked to authenticated;

-- Audit log access: "Access audit logs" is explicit in the Auditor
-- role's own definition. Same signature as
-- 20260730090000_audit_log_pagination.sql, so a plain CREATE OR REPLACE
-- is safe (no overload-ambiguity risk — see the AR partial-payments
-- migration's comment on that failure mode, which only applies when the
-- argument list itself changes).
create or replace function public.get_org_audit_log(p_org_id uuid, p_limit int default 200, p_before timestamptz default null)
returns table (
  created_at timestamptz,
  action text,
  log_type text,
  actor_id uuid,
  actor_username text,
  actor_via_sso boolean,
  ip_address text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not core.has_org_role(p_org_id, array['admin', 'auditor']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    a.created_at,
    a.payload->>'action' as action,
    a.payload->>'log_type' as log_type,
    safe_actor.actor_id,
    a.payload->>'actor_username' as actor_username,
    case lower(coalesce(a.payload->>'actor_via_sso', ''))
      when 'true' then true
      when 'false' then false
      else null
    end as actor_via_sso,
    a.ip_address::text as ip_address
  from auth.audit_log_entries a
  cross join lateral (
    select case
      when (a.payload->>'actor_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (a.payload->>'actor_id')::uuid
      else null
    end as actor_id
  ) as safe_actor
  where exists (
    select 1 from public.org_memberships m
    where m.org_id = p_org_id and m.user_id = safe_actor.actor_id
  )
  and (p_before is null or a.created_at < p_before)
  order by a.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.get_org_audit_log(uuid, int, timestamptz) from public, anon;
grant execute on function public.get_org_audit_log(uuid, int, timestamptz) to authenticated;
