-- Learning Management: the last item on the Full Feature Map gap-analysis
-- backlog. A lightweight training tracker, not a full e-learning platform —
-- this build has no video hosting or quiz infrastructure, so a "course" is
-- a catalog entry (title, description, an optional external link to the
-- actual material) and an "enrollment" is HR assigning that course to a
-- specific employee, who then self-reports completion. No content is
-- actually hosted or served by this app.
--
-- Two tables, same additive-RLS-per-role convention as every other module
-- this session:
--   training_courses — an admin/hr_manager-managed catalog (same shape as
--     shift_templates: org-wide SELECT via core.is_org_member, write access
--     gated to the managing roles). Every org member can see the catalog —
--     needed to recognize what a course is when it shows up on their own
--     enrollment list — only admin/hr_manager define new courses.
--   training_enrollments — one row per employee per course. admin/
--     hr_manager assign (insert/update/delete) org-wide. department_manager
--     gets read-only visibility into their own department's training
--     completion (a reporting need, not a day-to-day scheduling task the
--     way shift assignment is — assigning compliance training stays an HR
--     function, matching how this session has never let Department Manager
--     finalize anything except leave). auditor, chro and legal_compliance
--     all read org-wide, matching every other sensitive-record table.
--     An employee sees only their own enrollments and can mark one
--     complete themselves through a dedicated function — self-reported,
--     not verified — there's no quiz or completion certificate to check
--     against.
create table public.training_courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  description text,
  category text not null default 'other' check (category in ('compliance', 'onboarding', 'skills', 'safety', 'other')),
  is_mandatory boolean not null default false,
  external_url text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index training_courses_org_id_idx on public.training_courses (org_id);

alter table public.training_courses enable row level security;

create policy "org members can view training courses"
on public.training_courses for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and hr managers can create training courses"
on public.training_courses for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update training courses"
on public.training_courses for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete training courses"
on public.training_courses for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.training_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'completed')),
  assigned_by uuid not null references auth.users (id),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, course_id)
);

create index training_enrollments_org_id_idx on public.training_enrollments (org_id);
create index training_enrollments_employee_id_idx on public.training_enrollments (employee_id);
create index training_enrollments_course_id_idx on public.training_enrollments (course_id);
create index training_enrollments_status_idx on public.training_enrollments (status);

alter table public.training_enrollments enable row level security;

create policy "employees can view their own training enrollments"
on public.training_enrollments for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = training_enrollments.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and hr managers can view all training enrollments"
on public.training_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can view their department's training enrollments"
on public.training_enrollments for select
to authenticated
using (core.is_department_manager_of(training_enrollments.employee_id));

create policy "auditors can view training enrollments"
on public.training_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "chro can view training enrollments"
on public.training_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "legal and compliance can view training enrollments"
on public.training_enrollments for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

create policy "admins and hr managers can create training enrollments"
on public.training_enrollments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update any training enrollment"
on public.training_enrollments for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete training enrollments"
on public.training_enrollments for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Self-reported completion, the employee's only write path onto this
-- table — same shape as acknowledge_performance_appraisal: a dedicated
-- security-definer function rather than an open UPDATE grant, so an
-- employee can mark their own enrollment complete without ever touching
-- assignment fields (due_date, assigned_by) or another employee's row.
-- admin/hr_manager can also call it directly (e.g. logging completion on
-- an employee's behalf after an in-person session).
create or replace function public.mark_training_enrollment_complete(p_enrollment_id uuid)
returns public.training_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.training_enrollments;
  v_is_self boolean;
begin
  select * into v_enrollment from public.training_enrollments where id = p_enrollment_id;

  if v_enrollment.id is null then
    raise exception 'Enrollment % not found', p_enrollment_id;
  end if;

  select exists (
    select 1 from public.employees e
    where e.id = v_enrollment.employee_id and e.user_id = auth.uid()
  ) into v_is_self;

  if not (v_is_self or core.has_org_role(v_enrollment.org_id, array['admin', 'hr_manager'])) then
    raise exception 'You do not have permission to complete this enrollment';
  end if;

  if v_enrollment.status = 'completed' then
    raise exception 'Enrollment % is already completed', p_enrollment_id;
  end if;

  update public.training_enrollments
  set status = 'completed', completed_at = now()
  where id = p_enrollment_id
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;

revoke all on function public.mark_training_enrollment_complete(uuid) from public, anon;
grant execute on function public.mark_training_enrollment_complete(uuid) to authenticated;

insert into public.permissions (key, module, label) values
  ('training.manage', 'learning_management', 'Manage the training course catalog and assign enrollments'),
  ('training.view.department', 'learning_management', 'View training completion within own department');

insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'training.manage'),
  ('hr_manager', 'training.manage'),
  ('department_manager', 'training.view.department');

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
  'compensation_updated',
  'performance_goal_assigned',
  'performance_appraisal_submitted',
  'performance_appraisal_acknowledged',
  'interview_scheduled',
  'employee_relations_case_opened',
  'shift_assigned',
  'training_assigned'
));
