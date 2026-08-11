-- Configurable approval/workflow engine — feature-backlog.md §2's
-- "workflow and approval engine": approvals are currently scattered per
-- feature (leave, loans, expenses, overtime, leave encashment each with
-- their own hardcoded admin/payroll_manager/hr_manager check), and a
-- single multi-level, role-and-department-aware engine is "cheaper to
-- build once early than to retrofit across eight modules later."
--
-- Scope, deliberately conservative given this replaces a live
-- authorization path: this migration builds the generic engine and wires
-- ONE flow — leave requests — through it as the reference
-- implementation. Loans, expenses, overtime and leave encashment keep
-- their existing direct-RLS approval untouched; migrating each is a
-- separate, smaller follow-up once this pattern is proven, not bundled
-- in here.
--
-- Not built: delegation, escalation, and SLA tracking (explicitly named
-- in the backlog entry alongside multi-level approval). Reminders reuse
-- the existing core.check_pending_approvals() aging-reminder job
-- unchanged, since a leave request's pending state (and thus its
-- reminder eligibility) is unaffected by which specific step it's
-- waiting on.
--
-- Backward compatibility is structural, not a flag: an org that never
-- configures anything gets a single implicit step whose eligibility
-- rule is byte-for-byte the same as review_leave_request()'s prior
-- authorization (admin/hr_manager, or the employee's reporting manager,
-- or their department manager). Only an org that explicitly inserts
-- rows into approval_workflow_steps for 'leave_request' gets multi-step
-- behavior. Multiple rows at the same step_order are alternative
-- approvers for that step (any one suffices) — the same "OR" shape
-- review_leave_request() already had among admin/hr_manager/manager/
-- department-manager, now expressible as configuration instead of code.
create table public.approval_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  request_type text not null check (request_type in ('leave_request', 'loan', 'expense', 'overtime_request', 'leave_encashment_request')),
  step_order integer not null check (step_order > 0),
  approver_kind text not null check (approver_kind in ('role', 'reporting_manager', 'department_manager', 'specific_user')),
  approver_role text check (approver_role in ('admin', 'payroll_manager', 'hr_manager', 'accountant', 'department_manager', 'auditor', 'employee')),
  approver_user_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (
    (approver_kind = 'role' and approver_role is not null and approver_user_id is null)
    or (approver_kind = 'specific_user' and approver_user_id is not null and approver_role is null)
    or (approver_kind in ('reporting_manager', 'department_manager') and approver_role is null and approver_user_id is null)
  )
);

create index approval_workflow_steps_org_id_idx on public.approval_workflow_steps (org_id, request_type);

-- One row per actual request that has entered the approval flow —
-- polymorphic (request_table + request_id), same pattern as
-- core.approval_aging_notified's (request_table, request_id) key,
-- because the same shape is shared across five different request
-- tables and a dedicated column per table would mean five near-
-- identical tables instead of one.
create table public.approval_instances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  request_table text not null,
  request_id uuid not null,
  current_step_order integer not null default 1 check (current_step_order > 0),
  total_steps integer not null check (total_steps > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (request_table, request_id)
);

create index approval_instances_org_id_idx on public.approval_instances (org_id);

-- Append-only decision trail — who decided each step, and how. Never
-- updated or deleted; a request's full approval history is always
-- reconstructable from this table alone.
create table public.approval_instance_decisions (
  id uuid primary key default gen_random_uuid(),
  approval_instance_id uuid not null references public.approval_instances (id) on delete cascade,
  step_order integer not null,
  decided_by uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  decided_at timestamptz not null default now()
);

create index approval_instance_decisions_instance_id_idx on public.approval_instance_decisions (approval_instance_id);

alter table public.approval_workflow_steps enable row level security;
alter table public.approval_instances enable row level security;
alter table public.approval_instance_decisions enable row level security;

create policy "org members can view approval workflow steps"
on public.approval_workflow_steps for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins can create approval workflow steps"
on public.approval_workflow_steps for insert
to authenticated
with check (core.has_org_role(org_id, array['admin']));

create policy "admins can delete approval workflow steps"
on public.approval_workflow_steps for delete
to authenticated
using (core.has_org_role(org_id, array['admin']));

-- Visibility deliberately inherits the caller's own visibility into the
-- underlying request (via RLS on the joined table, which applies to this
-- subquery under the caller's own role same as any other query) rather
-- than re-deriving an authorization rule here — whoever can see a leave
-- request can see its approval trail, nothing more, nothing less.
create policy "org members can view approval instances for requests they can see"
on public.approval_instances for select
to authenticated
using (
  request_table = 'leave_requests'
  and exists (select 1 from public.leave_requests lr where lr.id = approval_instances.request_id)
);

create policy "org members can view approval decisions for requests they can see"
on public.approval_instance_decisions for select
to authenticated
using (
  exists (
    select 1 from public.approval_instances ai
    where ai.id = approval_instance_decisions.approval_instance_id
      and ai.request_table = 'leave_requests'
      and exists (select 1 from public.leave_requests lr where lr.id = ai.request_id)
  )
);

create or replace function core.leave_approval_total_steps(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(step_order), 1)
  from public.approval_workflow_steps
  where org_id = p_org_id and request_type = 'leave_request';
$$;

revoke all on function core.leave_approval_total_steps(uuid) from public, anon;
grant execute on function core.leave_approval_total_steps(uuid) to authenticated;

-- The eligibility check for one specific step. When the org has no
-- configured steps for 'leave_request' at all, falls back to the exact
-- three-way authorization review_leave_request() has always had —
-- structurally a single implicit step_order = 1, so a caller passing any
-- other step_order against an unconfigured org is correctly never
-- eligible (there is no step 2 to be eligible for).
create or replace function core.is_eligible_leave_approver(p_org_id uuid, p_employee_id uuid, p_step_order integer)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_config boolean;
begin
  select exists (
    select 1 from public.approval_workflow_steps
    where org_id = p_org_id and request_type = 'leave_request'
  ) into v_has_config;

  if not v_has_config then
    return p_step_order = 1 and (
      core.has_org_role(p_org_id, array['admin', 'hr_manager'])
      or core.is_manager_of(p_employee_id)
      or (
        core.has_org_role(p_org_id, array['department_manager'])
        and exists (
          select 1 from public.employees e
          where e.id = p_employee_id and core.is_manager_of_department(e.department_id)
        )
      )
    );
  end if;

  return exists (
    select 1
    from public.approval_workflow_steps s
    where s.org_id = p_org_id
      and s.request_type = 'leave_request'
      and s.step_order = p_step_order
      and (
        (s.approver_kind = 'role' and core.has_org_role(p_org_id, array[s.approver_role]))
        or (s.approver_kind = 'specific_user' and s.approver_user_id = auth.uid())
        or (s.approver_kind = 'reporting_manager' and core.is_manager_of(p_employee_id))
        or (
          s.approver_kind = 'department_manager'
          and exists (
            select 1 from public.employees e
            where e.id = p_employee_id and core.is_manager_of_department(e.department_id)
          )
        )
      )
  );
end;
$$;

revoke all on function core.is_eligible_leave_approver(uuid, uuid, integer) from public, anon;
grant execute on function core.is_eligible_leave_approver(uuid, uuid, integer) to authenticated;

-- review_leave_request(): full redeclare per 20260730020000_department_
-- manager.sql (the last migration to touch it). Same public signature
-- and same final observable behavior for every org that hasn't
-- configured a custom workflow — creates a one-step approval_instances
-- row lazily on first call, checks eligibility for the current step via
-- core.is_eligible_leave_approver, and on the (possibly only) final
-- step's approval does the exact same balance-decrement finalization as
-- before. A non-final step's approval just advances current_step_order
-- and leaves leave_requests.status at 'pending' — the request stays
-- visible in every existing pending-request view unchanged, now simply
-- awaiting the next configured step's approver instead of being done.
create or replace function public.review_leave_request(p_leave_request_id uuid, p_approve boolean)
returns public.leave_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leave public.leave_requests;
  v_instance public.approval_instances;
begin
  select * into v_leave from public.leave_requests where id = p_leave_request_id and status = 'pending';

  if v_leave.id is null then
    raise exception 'Leave request % not found or not pending', p_leave_request_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'leave_requests' and request_id = p_leave_request_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (v_leave.org_id, 'leave_requests', p_leave_request_id, 1, core.leave_approval_total_steps(v_leave.org_id))
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This leave request has already been fully decided';
  end if;

  if not core.is_eligible_leave_approver(v_leave.org_id, v_leave.employee_id, v_instance.current_step_order) then
    raise exception 'You do not have permission to review this leave request at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), case when p_approve then 'approved' else 'rejected' end);

  if not p_approve then
    update public.approval_instances set status = 'rejected' where id = v_instance.id;

    update public.leave_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_leave_request_id
    returning * into v_leave;

    return v_leave;
  end if;

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_leave;
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  update public.leave_requests
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_leave_request_id
  returning * into v_leave;

  if v_leave.leave_type = 'annual' then
    update public.employees
    set annual_leave_balance_days = annual_leave_balance_days - v_leave.days
    where id = v_leave.employee_id and annual_leave_balance_days >= v_leave.days;

    if not found then
      raise exception 'Employee has insufficient annual leave balance for this request';
    end if;
  end if;

  return v_leave;
end;
$$;

revoke all on function public.review_leave_request(uuid, boolean) from public;
grant execute on function public.review_leave_request(uuid, boolean) to authenticated;
