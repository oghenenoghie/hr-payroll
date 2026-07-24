-- Employee documents repository — the last unbuilt "Near-blocking" item in
-- feature-backlog.md's HR core section. Generic document storage (an
-- optional free-text document_type label, not a structured taxonomy) —
-- admin/HR-uploaded only, not employee self-upload, mirroring the
-- admin/HR-write pattern already used for onboarding/offboarding
-- checklists and company policies. First use of Supabase Storage in this
-- codebase: a private bucket with path convention
-- {org_id}/{employee_id}/{filename}, policed by storage.foldername(name)
-- path parsing since storage.objects has no org_id/employee_id columns
-- of its own. The employee_documents table is metadata/listing only —
-- the actual file bytes live in Storage, never duplicated into Postgres.
insert into storage.buckets (id, name, public)
values ('employee-documents', 'employee-documents', false)
on conflict (id) do nothing;

create policy "admins and HR managers can upload to employee-documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'employee-documents'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

create policy "admins, HR, payroll managers and the owning employee can view employee-documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'employee-documents'
  and (
    core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager', 'payroll_manager'])
    or exists (
      select 1 from public.employees e
      where e.id = (storage.foldername(name))[2]::uuid
        and e.user_id = auth.uid()
    )
  )
);

create policy "admins and HR managers can delete from employee-documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'employee-documents'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id),
  file_name text not null check (char_length(file_name) > 0),
  storage_path text not null unique,
  document_type text,
  uploaded_at timestamptz not null default now()
);

create index employee_documents_org_id_idx on public.employee_documents (org_id);
create index employee_documents_employee_id_idx on public.employee_documents (employee_id);

alter table public.employee_documents enable row level security;

create policy "admins, HR and payroll managers can view all employee documents"
on public.employee_documents for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager']));

create policy "employees can view their own documents"
on public.employee_documents for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = employee_documents.employee_id
      and e.user_id = auth.uid()
  )
);

create policy "admins and HR managers can upload employee documents"
on public.employee_documents for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can delete employee documents"
on public.employee_documents for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));
