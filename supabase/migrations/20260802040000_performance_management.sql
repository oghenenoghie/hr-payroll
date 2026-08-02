-- Performance Management: the Full Feature Map gap-analysis's #03
-- priority item. Job grades and compensation history already model an
-- employee's trajectory; goals, appraisals and a review cycle are the
-- natural next layer, and reuse infrastructure already built for leave/
-- overtime: core.is_manager_of() for direct-manager scope, the same
-- additive-RLS-per-role convention, and notifyUsers() for decisions.
--
-- Three tables:
--   performance_review_cycles — an admin/hr_manager-managed catalog
--     (same shape as job_grades/departments), e.g. "2026 H1 Review".
--     Every org member can see cycles (needed to pick one when setting
--     a goal), only admin/hr_manager manage them.
--   performance_goals — employee-owned, per cycle. An employee sets
--     their own goals; a direct manager or admin/hr_manager can also set
--     one for a report. Whoever can create one can also update its
--     status or delete it — no separate approval step, unlike a leave/
--     loan request, since a goal isn't asking permission for anything.
--   performance_appraisals — authored by a direct manager or admin/
--     hr_manager, never by the employee being reviewed. status moves
--     draft -> submitted (manager fields lock in intent, no DB
--     enforcement of that beyond the app not exposing further edits in
--     the UI) -> acknowledged (employee adds their own comment and
--     acknowledges having seen it, via a dedicated function so they can
--     never touch the rating or manager's comments themselves — the
--     same security-definer-with-explicit-auth-check shape as
--     review_leave_request()). One appraisal per employee per cycle.
--     No delete policy anywhere: an appraisal is a kept record once it
--     exists, matching journal_entries' immutability, not a working
--     draft that gets discarded.
--
-- Department Manager is deliberately left out of every policy below —
-- unlike leave, no role_permissions row was ever seeded for performance
-- data, so extending it now would be inventing scope rather than wiring
-- up something that already half-exists. A department_manager who also
-- happens to be a literal direct manager (manager_id-linked) still gets
-- access through core.is_manager_of(), same as any other role.
create table public.performance_review_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index performance_review_cycles_org_id_idx on public.performance_review_cycles (org_id);

alter table public.performance_review_cycles enable row level security;

create policy "org members can view review cycles"
on public.performance_review_cycles for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and hr managers can create review cycles"
on public.performance_review_cycles for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update review cycles"
on public.performance_review_cycles for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete review cycles"
on public.performance_review_cycles for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle_id uuid not null references public.performance_review_cycles (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  description text,
  target_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'cancelled')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index performance_goals_org_id_idx on public.performance_goals (org_id);
create index performance_goals_employee_id_idx on public.performance_goals (employee_id);
create index performance_goals_cycle_id_idx on public.performance_goals (cycle_id);

alter table public.performance_goals enable row level security;

create policy "employees can view their own goals"
on public.performance_goals for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = performance_goals.employee_id and e.user_id = auth.uid()
  )
);

create policy "managers can view their direct reports' goals"
on public.performance_goals for select
to authenticated
using (core.is_manager_of(performance_goals.employee_id));

create policy "admins and hr managers can view all goals"
on public.performance_goals for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "auditors can view goals"
on public.performance_goals for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "employees can create their own goals"
on public.performance_goals for insert
to authenticated
with check (
  exists (
    select 1 from public.employees e
    where e.id = performance_goals.employee_id and e.user_id = auth.uid()
  )
);

create policy "managers can create goals for their direct reports"
on public.performance_goals for insert
to authenticated
with check (core.is_manager_of(performance_goals.employee_id));

create policy "admins and hr managers can create goals for anyone"
on public.performance_goals for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "employees can update their own goals"
on public.performance_goals for update
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = performance_goals.employee_id and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = performance_goals.employee_id and e.user_id = auth.uid()
  )
);

create policy "managers can update their direct reports' goals"
on public.performance_goals for update
to authenticated
using (core.is_manager_of(performance_goals.employee_id))
with check (core.is_manager_of(performance_goals.employee_id));

create policy "admins and hr managers can update any goal"
on public.performance_goals for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "employees can delete their own goals"
on public.performance_goals for delete
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = performance_goals.employee_id and e.user_id = auth.uid()
  )
);

create policy "managers can delete their direct reports' goals"
on public.performance_goals for delete
to authenticated
using (core.is_manager_of(performance_goals.employee_id));

create policy "admins and hr managers can delete any goal"
on public.performance_goals for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.performance_appraisals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  cycle_id uuid not null references public.performance_review_cycles (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  strengths text,
  areas_for_improvement text,
  manager_comments text,
  employee_comments text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'acknowledged')),
  reviewed_by uuid references auth.users (id),
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, cycle_id)
);

create index performance_appraisals_org_id_idx on public.performance_appraisals (org_id);
create index performance_appraisals_employee_id_idx on public.performance_appraisals (employee_id);
create index performance_appraisals_cycle_id_idx on public.performance_appraisals (cycle_id);

alter table public.performance_appraisals enable row level security;

create policy "employees can view their own appraisals"
on public.performance_appraisals for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = performance_appraisals.employee_id and e.user_id = auth.uid()
  )
);

create policy "managers can view their direct reports' appraisals"
on public.performance_appraisals for select
to authenticated
using (core.is_manager_of(performance_appraisals.employee_id));

create policy "admins and hr managers can view all appraisals"
on public.performance_appraisals for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "auditors can view appraisals"
on public.performance_appraisals for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "managers can create appraisals for their direct reports"
on public.performance_appraisals for insert
to authenticated
with check (core.is_manager_of(performance_appraisals.employee_id));

create policy "admins and hr managers can create appraisals for anyone"
on public.performance_appraisals for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Covers both the manager's own draft/submitted editing (rating,
-- strengths, areas_for_improvement, manager_comments, status,
-- submitted_at, reviewed_by) — the employee's acknowledgement path never
-- goes through this policy, only acknowledge_performance_appraisal()
-- below, so a manager-only UPDATE grant here can't be used to bypass it.
create policy "managers can update their direct reports' appraisals"
on public.performance_appraisals for update
to authenticated
using (core.is_manager_of(performance_appraisals.employee_id))
with check (core.is_manager_of(performance_appraisals.employee_id));

create policy "admins and hr managers can update any appraisal"
on public.performance_appraisals for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- The employee being reviewed gets no general UPDATE policy at all —
-- only this function, so they can add their own comment and acknowledge
-- having seen the review, but never touch the rating or the manager's
-- own comments. Same security-definer-with-explicit-auth-check shape as
-- review_leave_request(): the caller's identity and the row's current
-- status are both checked inside the function, not left to RLS.
create or replace function public.acknowledge_performance_appraisal(p_appraisal_id uuid, p_employee_comments text default null)
returns public.performance_appraisals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appraisal public.performance_appraisals;
begin
  select * into v_appraisal from public.performance_appraisals where id = p_appraisal_id;

  if v_appraisal.id is null then
    raise exception 'Appraisal % not found', p_appraisal_id;
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = v_appraisal.employee_id and e.user_id = auth.uid()
  ) then
    raise exception 'You do not have permission to acknowledge this appraisal';
  end if;

  if v_appraisal.status <> 'submitted' then
    raise exception 'Appraisal % is not awaiting acknowledgement (status: %)', p_appraisal_id, v_appraisal.status;
  end if;

  update public.performance_appraisals
  set status = 'acknowledged', acknowledged_at = now(), employee_comments = p_employee_comments
  where id = p_appraisal_id
  returning * into v_appraisal;

  return v_appraisal;
end;
$$;

revoke all on function public.acknowledge_performance_appraisal(uuid, text) from public, anon;
grant execute on function public.acknowledge_performance_appraisal(uuid, text) to authenticated;

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
  'performance_appraisal_acknowledged'
));
