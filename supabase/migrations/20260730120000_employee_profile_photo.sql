-- Employee profile photo — a round image shown at the top of the View
-- Employee page. Follows the same private-bucket-plus-signed-URL pattern
-- employee_documents already established (20260724040000), rather than a
-- public bucket: a face photo is still personal data, and this codebase's
-- convention throughout is "private storage, signed URL per request",
-- never a publicly guessable file URL.
--
-- Unlike employee_documents (many files per employee, admin/HR-uploaded
-- only), a photo is exactly one file per employee, always re-uploaded to
-- the *same* storage path — path convention {org_id}/{employee_id}/photo,
-- no original filename or extension in the path, so re-uploading a new
-- photo overwrites the old object in place (upsert) rather than leaving
-- an orphaned file behind every time someone changes it. Storage still
-- records the real content-type at upload time, so the browser renders
-- it correctly regardless of the extension-less path.
--
-- View access matches exactly who can already see the employee record
-- itself (public.employees' own "org staff / self / their manager" SELECT
-- policies), not the narrower admin/HR/payroll_manager-only visibility
-- employee_documents uses — a profile photo isn't sensitive the way a
-- document upload can be. Upload/delete stays admin/HR-only, matching who
-- can already edit the employee record.
alter table public.employees add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', false)
on conflict (id) do nothing;

drop policy if exists "admins and HR managers can upload employee photos" on storage.objects;
create policy "admins and HR managers can upload employee photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'employee-photos'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

drop policy if exists "org staff, the employee and manager can view employee photos" on storage.objects;
create policy "org staff, the employee and manager can view employee photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'employee-photos'
  and (
    core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager', 'payroll_manager'])
    or exists (
      select 1 from public.employees e
      where e.id = (storage.foldername(name))[2]::uuid
        and (e.user_id = auth.uid() or core.is_manager_of(e.id))
    )
  )
);

drop policy if exists "admins and HR managers can delete employee photos" on storage.objects;
create policy "admins and HR managers can delete employee photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'employee-photos'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

-- Re-published with the one added column; every other column, join and
-- masking rule is unchanged from 20260729020000_employee_id_login.sql.
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
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.basic_kobo end as basic_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.housing_kobo end as housing_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.transport_kobo end as transport_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.annual_rent_kobo end as annual_rent_kobo,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.bank_name end as bank_name,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
    then null else e.bank_account_number end as bank_account_number,
  case when e.salary_masked and not core.has_org_role(e.org_id, array['admin', 'payroll_manager'])
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
