-- Employee Relations: case management for grievances, disciplinary matters,
-- and workplace investigations. Next Full Feature Map gap-analysis item
-- after Compensation & Benefits Manager / Finance Manager and the per-role
-- dashboards.
--
-- Two tables, same additive-RLS-per-role convention as every other module
-- this session:
--   employee_relations_cases — one row per grievance/disciplinary/
--     investigation matter, always about a specific employee
--     (employee_id). raised_by_user_id records who filed it (HR, a
--     manager, or the employee themself for a self-raised grievance) but
--     is not itself an access grant — access is role-based, below.
--   employee_relations_case_notes — an append-only timeline on a case
--     (note added, warning issued, meeting held, escalated, resolved).
--     No update/delete policy anywhere, matching performance_appraisals'
--     and journal_entries' "kept record" convention: once logged, a case
--     note is part of the record.
--
-- Deliberate design call, documented here so it's easy to revisit: the
-- employee who is the SUBJECT of a case gets NO row-level visibility in
-- this migration, at any status. Unlike performance_appraisals (an
-- intentionally two-way employee/manager artifact) or leave_requests (the
-- employee's own request), a grievance or disciplinary case is HR case-
-- management tooling — outcomes are communicated to the employee outside
-- this system (a letter, a meeting), not through in-app self-service. If
-- a future requirement needs in-app visibility for the subject (e.g. once
-- a case is formally 'resolved'), that's a additive follow-up, not a
-- reason to hold this one.
--
-- Access: admin and hr_manager get full CRUD on cases. department_manager
-- gets SELECT + INSERT scoped to their own department (via
-- core.is_department_manager_of, the same helper 20260802020000 already
-- built) — a line manager can see and raise a matter about their own
-- report, but only HR/admin can update status or resolve it, matching
-- how this session has never let Department Manager finalize anything
-- (leave approval is the one exception, and it's a pre-existing seeded
-- permission; this module has no such precedent so it isn't invented
-- here). auditor gets SELECT only, same as every other sensitive-record
-- table this session (performance goals/appraisals). Case notes follow
-- the same shape: admin/hr_manager full read+insert, department_manager
-- read+insert scoped to their department's cases, auditor read-only.
create table public.employee_relations_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  case_type text not null check (case_type in ('grievance', 'disciplinary', 'investigation')),
  title text not null check (char_length(title) > 0),
  description text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  raised_by_user_id uuid references auth.users (id),
  resolution text,
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_relations_cases_org_id_idx on public.employee_relations_cases (org_id);
create index employee_relations_cases_employee_id_idx on public.employee_relations_cases (employee_id);
create index employee_relations_cases_status_idx on public.employee_relations_cases (status);

alter table public.employee_relations_cases enable row level security;

create policy "admins and hr managers can view all cases"
on public.employee_relations_cases for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can view their department's cases"
on public.employee_relations_cases for select
to authenticated
using (core.is_department_manager_of(employee_relations_cases.employee_id));

create policy "auditors can view cases"
on public.employee_relations_cases for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can create cases"
on public.employee_relations_cases for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can create cases for their department"
on public.employee_relations_cases for insert
to authenticated
with check (core.is_department_manager_of(employee_relations_cases.employee_id));

create policy "admins and hr managers can update any case"
on public.employee_relations_cases for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete cases"
on public.employee_relations_cases for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.employee_relations_case_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.employee_relations_cases (id) on delete cascade,
  author_user_id uuid not null references auth.users (id),
  action_type text not null default 'note' check (action_type in ('note', 'warning_issued', 'meeting_held', 'escalated', 'resolved')),
  note text not null check (char_length(note) > 0),
  created_at timestamptz not null default now()
);

create index employee_relations_case_notes_org_id_idx on public.employee_relations_case_notes (org_id);
create index employee_relations_case_notes_case_id_idx on public.employee_relations_case_notes (case_id);

alter table public.employee_relations_case_notes enable row level security;

create policy "admins and hr managers can view all case notes"
on public.employee_relations_case_notes for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can view their department's case notes"
on public.employee_relations_case_notes for select
to authenticated
using (
  exists (
    select 1 from public.employee_relations_cases c
    where c.id = employee_relations_case_notes.case_id
      and core.is_department_manager_of(c.employee_id)
  )
);

create policy "auditors can view case notes"
on public.employee_relations_case_notes for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "admins and hr managers can add case notes"
on public.employee_relations_case_notes for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can add notes to their department's cases"
on public.employee_relations_case_notes for insert
to authenticated
with check (
  exists (
    select 1 from public.employee_relations_cases c
    where c.id = employee_relations_case_notes.case_id
      and core.is_department_manager_of(c.employee_id)
  )
);

-- Resolving a case is an HR/admin action (matches the "only admin/
-- hr_manager can finalize" split above); wraps status + resolution
-- fields together and appends the closing case note atomically, the same
-- security-definer shape as review_leave_request()/
-- acknowledge_performance_appraisal().
create or replace function public.resolve_employee_relations_case(
  p_case_id uuid,
  p_resolution text
)
returns public.employee_relations_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.employee_relations_cases;
begin
  select * into v_case from public.employee_relations_cases where id = p_case_id;

  if v_case.id is null then
    raise exception 'Case % not found', p_case_id;
  end if;

  if not core.has_org_role(v_case.org_id, array['admin', 'hr_manager']) then
    raise exception 'You do not have permission to resolve this case';
  end if;

  if v_case.status in ('resolved', 'closed') then
    raise exception 'Case % is already %', p_case_id, v_case.status;
  end if;

  update public.employee_relations_cases
  set status = 'resolved', resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
  where id = p_case_id
  returning * into v_case;

  insert into public.employee_relations_case_notes (org_id, case_id, author_user_id, action_type, note)
  values (v_case.org_id, v_case.id, auth.uid(), 'resolved', p_resolution);

  return v_case;
end;
$$;

revoke all on function public.resolve_employee_relations_case(uuid, text) from public, anon;
grant execute on function public.resolve_employee_relations_case(uuid, text) to authenticated;

insert into public.permissions (key, module, label) values
  ('employee_relations.manage', 'employee_relations', 'Manage grievance and disciplinary cases'),
  ('employee_relations.view.department', 'employee_relations', 'View employee relations cases within own department');

insert into public.role_permissions (role_key, permission_key) values
  ('admin', 'employee_relations.manage'),
  ('hr_manager', 'employee_relations.manage'),
  ('department_manager', 'employee_relations.view.department');

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
  'employee_relations_case_opened'
));
