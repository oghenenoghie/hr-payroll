-- Auditor role: strictly read-only, additive SELECT policies only — never
-- added to any INSERT/UPDATE/DELETE policy anywhere. Scoped to the tables
-- that carry payroll, statutory and lifecycle audit trail (per
-- product-and-ia.md's Security & Access description: "Role-based access,
-- MFA and audit logs"). Tables already open to every org member
-- (departments, branches, job_grades, benefit_plans, company_policies) and
-- purely personal ones (notifications) need no change.
create policy "auditors can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view journal entries"
on public.journal_entries for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view ledger postings"
on public.ledger_postings for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view pay run reversals"
on public.pay_run_reversals for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all loans"
on public.loans for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all loan repayments"
on public.loan_repayments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all expense claims"
on public.expenses for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all overtime requests"
on public.overtime_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all leave requests"
on public.leave_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all leave encashment requests"
on public.leave_encashment_requests for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all attendance records"
on public.attendance_records for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view all employee documents"
on public.employee_documents for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "auditors can view employee-documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'employee-documents'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['auditor'])
);

create policy "auditors can view all benefit enrollments"
on public.employee_benefit_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

-- employees: same directory visibility as hr_manager/accountant, still
-- subject to salary masking via employees_masked (auditors are not added
-- to the masking bypass array — read-only access to statutory/audit data
-- doesn't require seeing real salary figures where an employee has opted
-- to mask them from non-payroll roles).
drop policy if exists "org staff can view employees" on public.employees;
create policy "org staff can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'hr_manager', 'accountant', 'auditor']));

-- get_org_audit_log(): full redeclare per 20260723140000_audit_log.sql,
-- 'auditor' added to the authorization check. Application-layer gate
-- widened to match in security/page.tsx and security/audit-log/page.tsx.
create or replace function public.get_org_audit_log(p_org_id uuid, p_limit int default 200)
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
  ) safe_actor
  where exists (
    select 1 from public.org_memberships om
    where om.org_id = p_org_id
      and om.user_id = safe_actor.actor_id
  )
  order by a.created_at desc
  limit least(coalesce(p_limit, 200), 500);
end;
$$;

revoke all on function public.get_org_audit_log(uuid, int) from public, anon, authenticated;
grant execute on function public.get_org_audit_log(uuid, int) to authenticated;
