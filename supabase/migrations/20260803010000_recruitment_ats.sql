-- Recruitment/ATS: the Full Feature Map gap-analysis's #04 priority
-- item, and a genuinely new module — unlike Auditor/Department Manager/
-- Performance Management, there's no existing schema this builds on.
--
-- Three tables, a pipeline shape: job_requisitions (a role to fill) ->
-- candidates (one row per person applying to one requisition — not a
-- many-to-many candidates/applications model; a person applying to two
-- roles is two candidate rows, kept simple deliberately) ->
-- candidate_interviews (who's interviewing them and when). A "hire"
-- action (in application code, not this migration) converts a candidate
-- into a real public.employees row and links back via
-- candidates.hired_employee_id — the one integration point connecting
-- this module to the rest of the app. That new employee gets only a
-- bare HR record (name, email, department, job grade, hire date) —
-- compensation, banking, TIN and a login are deliberately left for the
-- existing Edit Employee page and Security & Access to fill in
-- afterward, the same two places that already own those steps for any
-- other new hire, rather than duplicating that logic here.
--
-- Unlike every other HR/payroll table in this app, an interviewer isn't
-- necessarily hr_manager or admin — it can be any employee asked to sit
-- in on an interview. So alongside the usual admin/hr_manager-manages-
-- everything policies, each table also gets one narrow additive policy
-- keyed on candidate_interviews.interviewer_id = auth.uid(): an
-- interviewer sees the requisition and candidate they're assigned to
-- (for context) and their own interview record, and can record their
-- own outcome/notes — nothing else. Same additive-policy-per-role
-- convention as every other module this session, just keyed on a
-- narrower identity than a role or a manager_id link.
create table public.job_requisitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  department_id uuid references public.departments (id) on delete set null,
  job_grade_id uuid references public.job_grades (id) on delete set null,
  description text,
  status text not null default 'open' check (status in ('open', 'on_hold', 'closed', 'filled')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index job_requisitions_org_id_idx on public.job_requisitions (org_id);

alter table public.job_requisitions enable row level security;

create policy "admins and hr managers can view requisitions"
on public.job_requisitions for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "auditors can view requisitions"
on public.job_requisitions for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can create requisitions"
on public.job_requisitions for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update requisitions"
on public.job_requisitions for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete requisitions"
on public.job_requisitions for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  requisition_id uuid not null references public.job_requisitions (id) on delete cascade,
  full_name text not null check (char_length(full_name) > 0),
  email text,
  phone text,
  resume_link text,
  source text,
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'interviewing', 'offer', 'hired', 'rejected')),
  rejected_reason text,
  hired_employee_id uuid references public.employees (id) on delete set null,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_org_id_idx on public.candidates (org_id);
create index candidates_requisition_id_idx on public.candidates (requisition_id);

alter table public.candidates enable row level security;

create policy "admins and hr managers can view candidates"
on public.candidates for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "auditors can view candidates"
on public.candidates for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can create candidates"
on public.candidates for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update candidates"
on public.candidates for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete candidates"
on public.candidates for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.candidate_interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  interviewer_id uuid not null references auth.users (id),
  scheduled_at timestamptz not null,
  notes text,
  outcome text not null default 'pending' check (outcome in ('pending', 'passed', 'failed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index candidate_interviews_org_id_idx on public.candidate_interviews (org_id);
create index candidate_interviews_candidate_id_idx on public.candidate_interviews (candidate_id);
create index candidate_interviews_interviewer_id_idx on public.candidate_interviews (interviewer_id);

alter table public.candidate_interviews enable row level security;

create policy "admins and hr managers can view interviews"
on public.candidate_interviews for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "interviewers can view their own interviews"
on public.candidate_interviews for select
to authenticated
using (interviewer_id = auth.uid());

create policy "auditors can view interviews"
on public.candidate_interviews for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can schedule interviews"
on public.candidate_interviews for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update interviews"
on public.candidate_interviews for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- An interviewer records their own outcome/notes — the same narrow,
-- identity-keyed write grant used for acknowledging a performance
-- appraisal, except this one is a plain RLS policy rather than a
-- function: unlike an appraisal rating, an interview's own outcome/notes
-- aren't a field anyone else has already written and needs protecting
-- from being overwritten, so no extra function-level guard is needed.
create policy "interviewers can update their own interviews"
on public.candidate_interviews for update
to authenticated
using (interviewer_id = auth.uid())
with check (interviewer_id = auth.uid());

create policy "admins and hr managers can delete interviews"
on public.candidate_interviews for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Defined here rather than alongside candidates'/job_requisitions' other
-- SELECT policies above, since both have to come after
-- candidate_interviews exists — the table these policies' subqueries
-- read from.
create policy "interviewers can view their assigned candidates"
on public.candidates for select
to authenticated
using (
  exists (
    select 1 from public.candidate_interviews ci
    where ci.candidate_id = candidates.id and ci.interviewer_id = auth.uid()
  )
);

create policy "interviewers can view requisitions for their assigned candidates"
on public.job_requisitions for select
to authenticated
using (
  exists (
    select 1
    from public.candidates c
    join public.candidate_interviews ci on ci.candidate_id = c.id
    where c.requisition_id = job_requisitions.id and ci.interviewer_id = auth.uid()
  )
);

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
  'interview_scheduled'
));
