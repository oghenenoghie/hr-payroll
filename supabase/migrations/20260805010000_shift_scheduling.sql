-- Time & Attendance shift scheduling: the Full Feature Map gap-analysis's
-- next priority item after Employee Relations. Distinct from the existing
-- attendance_records table (20260723120000_attendance.sql) — that one is a
-- weekly Present/Late/Absent grid feeding payroll deductions after the
-- fact; this is a forward-looking roster: which shift (morning/evening/
-- night, or whatever an org defines) an employee is scheduled to work on a
-- given day. Neither table touches the other; assigning a shift doesn't
-- imply attendance, and marking attendance doesn't require a shift
-- assignment to exist.
--
-- Two tables, same additive-RLS-per-role convention as every other module
-- this session:
--   shift_templates — an admin/hr_manager-managed catalog (same shape as
--     departments/job_grades: org-wide SELECT via core.is_org_member,
--     write access gated to the managing roles), e.g. "Morning
--     08:00–16:00". Every org member can see the catalog (needed to
--     recognize what a shift code means), only admin/hr_manager define
--     new shift types.
--   shift_assignments — one row per employee per date, assigning a shift
--     template. Unlike Employee Relations (an HR-finalizes-only module),
--     shift scheduling is treated as the same kind of day-to-day
--     operational task leave/overtime approval already extended to
--     Department Manager: full CRUD for admin/hr_manager org-wide, and
--     full CRUD for department_manager scoped to their own department via
--     the existing core.is_department_manager_of() helper — a line
--     manager building their own team's weekly roster is exactly the
--     scope that role already covers for leave and overtime. auditor gets
--     read-only, matching every other sensitive-record table this
--     session. An employee sees only their own assignments — this is a
--     schedule they're told, not one they can edit.
create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index shift_templates_org_id_idx on public.shift_templates (org_id);

alter table public.shift_templates enable row level security;

create policy "org members can view shift templates"
on public.shift_templates for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and hr managers can create shift templates"
on public.shift_templates for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update shift templates"
on public.shift_templates for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete shift templates"
on public.shift_templates for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_template_id uuid not null references public.shift_templates (id) on delete cascade,
  date date not null,
  assigned_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

create index shift_assignments_org_id_idx on public.shift_assignments (org_id);
create index shift_assignments_employee_id_idx on public.shift_assignments (employee_id);
create index shift_assignments_org_id_date_idx on public.shift_assignments (org_id, date);

alter table public.shift_assignments enable row level security;

create policy "employees can view their own shift assignments"
on public.shift_assignments for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = shift_assignments.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and hr managers can view all shift assignments"
on public.shift_assignments for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can view their department's shift assignments"
on public.shift_assignments for select
to authenticated
using (core.is_department_manager_of(shift_assignments.employee_id));

create policy "auditors can view shift assignments"
on public.shift_assignments for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can create shift assignments"
on public.shift_assignments for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can create shift assignments for their department"
on public.shift_assignments for insert
to authenticated
with check (core.is_department_manager_of(shift_assignments.employee_id));

create policy "admins and hr managers can update any shift assignment"
on public.shift_assignments for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can update their department's shift assignments"
on public.shift_assignments for update
to authenticated
using (core.is_department_manager_of(shift_assignments.employee_id))
with check (core.is_department_manager_of(shift_assignments.employee_id));

create policy "admins and hr managers can delete any shift assignment"
on public.shift_assignments for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can delete their department's shift assignments"
on public.shift_assignments for delete
to authenticated
using (core.is_department_manager_of(shift_assignments.employee_id));

insert into public.permissions (key, module, label) values
  ('shift_templates.manage', 'shift_scheduling', 'Define shift types (name, start/end time)'),
  ('shift_assignments.manage', 'shift_scheduling', 'Assign employees to shifts');

insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'shift_templates.manage'),
  ('admin', 'shift_assignments.manage'),
  ('hr_manager', 'shift_templates.manage'),
  ('hr_manager', 'shift_assignments.manage'),
  ('department_manager', 'shift_assignments.manage');

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
  'shift_assigned'
));
