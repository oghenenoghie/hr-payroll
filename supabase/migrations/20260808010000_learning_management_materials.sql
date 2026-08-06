-- Course material attachments: files (slide decks, PDFs, short video
-- clips) admin/hr_manager can attach directly to a training_courses
-- catalog entry, alongside the existing external_url link. This still
-- isn't a full video-hosting/streaming platform — Supabase Storage holds
-- the raw bytes and every viewer gets a signed URL per request, the same
-- shape as employee_documents/employee-photos already established — so a
-- multi-gigabyte training video isn't practical here, but slide decks,
-- PDFs and short clips are (app-enforced 20MB per file).
--
-- Storage path convention: {org_id}/{course_id}/{random}-{original
-- filename} — mirrors employee_documents, not employee-photos' single
-- fixed path, since one course can have several attached files. Bucket
-- policies parse org_id/course_id straight out of storage.foldername(name),
-- the same pattern the other two Storage-backed features already use.
--
-- Read access matches training_courses' own SELECT policy: every org
-- member can see and download a course's materials, not just admin/hr —
-- an employee assigned the course obviously needs to reach the content.
-- Write (upload/delete) stays admin/hr_manager-only, same as the courses
-- catalog itself. No update policy, matching employee_documents' "kept
-- record, replace via delete+reupload" convention.
insert into storage.buckets (id, name, public)
values ('training-materials', 'training-materials', false)
on conflict (id) do nothing;

create policy "admins and hr managers can upload training materials"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'training-materials'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

create policy "org members can view training materials"
on storage.objects for select
to authenticated
using (
  bucket_id = 'training-materials'
  and core.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "admins and hr managers can delete training materials"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'training-materials'
  and core.has_org_role((storage.foldername(name))[1]::uuid, array['admin', 'hr_manager'])
);

create table public.training_course_materials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id),
  file_name text not null check (char_length(file_name) > 0),
  storage_path text not null unique,
  uploaded_at timestamptz not null default now()
);

create index training_course_materials_org_id_idx on public.training_course_materials (org_id);
create index training_course_materials_course_id_idx on public.training_course_materials (course_id);

alter table public.training_course_materials enable row level security;

create policy "org members can view training course materials"
on public.training_course_materials for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and hr managers can add training course materials"
on public.training_course_materials for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete training course materials"
on public.training_course_materials for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));
