-- CHRO and Legal & Compliance: the Full Feature Map gap-analysis's last
-- two roles, split the same way Compensation & Benefits Manager and
-- Finance Manager/CFO were — one gap-analysis line item, two distinct
-- personas, so two roles rather than one conflated permission set.
--
-- CHRO is executive-level, read-only visibility across every HR domain —
-- workforce (including unmasked salary, the same "owns the real figures"
-- reasoning Auditor and Compensation & Benefits Manager already join the
-- unmask list for), recruitment, performance, employee relations,
-- benefits, compensation history, workforce-operational data (leave,
-- overtime, attendance, status history), and workforce cost (pay runs,
-- payslips, final settlements) — but deliberately NOT accounting/
-- financial tables (chart of accounts, ledger, AP/AR, budgets, bank
-- reconciliation, fixed assets) or the authentication audit log. That
-- split mirrors Compensation & Benefits Manager vs. Finance Manager
-- exactly: CHRO owns the HR picture, Finance owns the financial one,
-- neither touches the other's territory.
--
-- Legal & Compliance is narrower and read-only, focused specifically on
-- legal-exposure and statutory-compliance data: employee relations cases
-- (grievances/disciplinary — direct legal exposure), status history and
-- final settlements (termination compliance), leave/overtime (statutory
-- entitlement compliance), policy acknowledgements, onboarding/
-- offboarding checklists, and — unlike CHRO — the authentication audit
-- log, since that's a security/access-oversight concern (Supabase Auth's
-- own login/session trail), not an HR-operations one. Deliberately NOT
-- given unmasked salary, recruitment, performance, benefits or
-- compensation history — that's CHRO's territory, and pay equity/
-- comp-related legal review isn't asked for here, so it isn't invented.
-- Employee base records stay masked for this role, same default everyone
-- who isn't explicitly granted the unmask list gets.
--
-- Every policy below is additive (new "chro can view X" / "legal and
-- compliance can view X" policy per table, nothing dropped or replaced),
-- the same convention as every other role this session.
insert into public.roles (key, label, mfa_required, sort_order) values
  ('chro', 'CHRO', false, 9),
  ('legal_compliance', 'Legal & Compliance', false, 10);

insert into public.permissions (key, module, label) values
  ('hr.report.view', 'hr_reporting', 'View organization-wide HR reporting data'),
  ('legal.compliance.view', 'legal_compliance', 'View legal and compliance-sensitive records');

insert into public.role_permissions (role_key, permission_key) values
  ('chro', 'hr.report.view'),
  ('chro', 'salary.view.unmasked'),
  ('legal_compliance', 'legal.compliance.view'),
  ('legal_compliance', 'audit.read');

-- CHRO: workforce, recruitment, performance, employee relations, benefits.
create policy "chro can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view all benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view goals"
on public.performance_goals for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view appraisals"
on public.performance_appraisals for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view requisitions"
on public.job_requisitions for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view candidates"
on public.candidates for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view interviews"
on public.candidate_interviews for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view cases"
on public.employee_relations_cases for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view case notes"
on public.employee_relations_case_notes for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view shift assignments"
on public.shift_assignments for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view leave requests"
on public.leave_requests for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view overtime requests"
on public.overtime_requests for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view attendance records"
on public.attendance_records for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view policy acknowledgements"
on public.policy_acknowledgements for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "chro can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

-- Legal & Compliance: employee relations, termination compliance,
-- statutory leave/overtime, policy acknowledgements, checklists.
create policy "legal and compliance can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view cases"
on public.employee_relations_cases for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view case notes"
on public.employee_relations_case_notes for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view leave requests"
on public.leave_requests for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view overtime requests"
on public.overtime_requests for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view policy acknowledgements"
on public.policy_acknowledgements for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "legal and compliance can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

-- Salary masking: CHRO joins the unmask list (same "owns the real
-- figures" reasoning as Auditor/Compensation & Benefits Manager).
-- Legal & Compliance deliberately does not — republishing the view
-- exactly as it stood in 20260803020000_compensation_and_finance_roles.sql
-- with that one addition.
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
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager', 'auditor', 'compensation_benefits_manager', 'chro'])
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

-- Audit log: Legal & Compliance joins the authority list (a security/
-- access-oversight duty, not an HR-operations one — that's why CHRO is
-- deliberately not added here). Republished exactly as it stood in
-- 20260803020000_compensation_and_finance_roles.sql with that one
-- addition.
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
  if not core.has_org_role(p_org_id, array['admin', 'auditor', 'finance_manager', 'legal_compliance']) then
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
