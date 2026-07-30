-- Migrates loans, expenses, overtime requests and leave encashment onto
-- the approval_workflow_steps engine (20260731020000_configurable_
-- approval_engine.sql), the follow-up flagged when that migration wired
-- only leave requests as the reference implementation. Same conservative,
-- backward-compatible-by-construction shape: an org with zero configured
-- steps for a request_type gets a single implicit step, byte-for-byte
-- the prior hardcoded authorization for that type
-- (admin/payroll_manager/accountant — none of these four ever had a
-- reporting-manager or department-manager fallback the way leave did).
--
-- core.is_eligible_leave_approver() and core.leave_approval_total_steps()
-- are generalized into core.is_eligible_request_approver() and
-- core.approval_total_steps(), parameterized by request_type. The old
-- leave-specific names are kept as thin wrappers (review_leave_request
-- still calls them by name) rather than redeclaring that function again
-- in this migration for a change that doesn't affect its behavior.
create or replace function core.is_eligible_request_approver(
  p_org_id uuid,
  p_request_type text,
  p_employee_id uuid,
  p_step_order integer
)
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
    where org_id = p_org_id and request_type = p_request_type
  ) into v_has_config;

  if not v_has_config then
    if p_step_order <> 1 then
      return false;
    end if;

    if p_request_type = 'leave_request' then
      return core.has_org_role(p_org_id, array['admin', 'hr_manager'])
        or core.is_manager_of(p_employee_id)
        or (
          core.has_org_role(p_org_id, array['department_manager'])
          and exists (
            select 1 from public.employees e
            where e.id = p_employee_id and core.is_manager_of_department(e.department_id)
          )
        );
    end if;

    -- loans, expenses, overtime_requests, leave_encashment_requests: the
    -- same admin/payroll_manager/accountant set every one of them has
    -- always used, none with a manager-based fallback.
    return core.has_org_role(p_org_id, array['admin', 'payroll_manager', 'accountant']);
  end if;

  return exists (
    select 1
    from public.approval_workflow_steps s
    where s.org_id = p_org_id
      and s.request_type = p_request_type
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

revoke all on function core.is_eligible_request_approver(uuid, text, uuid, integer) from public, anon;
grant execute on function core.is_eligible_request_approver(uuid, text, uuid, integer) to authenticated;

create or replace function core.approval_total_steps(p_org_id uuid, p_request_type text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(step_order), 1)
  from public.approval_workflow_steps
  where org_id = p_org_id and request_type = p_request_type;
$$;

revoke all on function core.approval_total_steps(uuid, text) from public, anon;
grant execute on function core.approval_total_steps(uuid, text) to authenticated;

create or replace function core.is_eligible_leave_approver(p_org_id uuid, p_employee_id uuid, p_step_order integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.is_eligible_request_approver(p_org_id, 'leave_request', p_employee_id, p_step_order);
$$;

revoke all on function core.is_eligible_leave_approver(uuid, uuid, integer) from public, anon;
grant execute on function core.is_eligible_leave_approver(uuid, uuid, integer) to authenticated;

-- loans / expenses / overtime_requests previously had a broad direct-
-- table UPDATE policy (admin/payroll_manager/accountant, no step
-- awareness). Once approval goes through a step-checked RPC, that policy
-- is a bypass — someone holding the base role could UPDATE the row
-- directly and skip whatever step the org configured. Drop it, the same
-- way leave_encashment_requests was designed from the start ("no direct-
-- update escape hatch"). SELECT policies (already existing, unaffected)
-- keep read access exactly as it was.
drop policy if exists "admins and payroll managers can update loans" on public.loans;
drop policy if exists "admins and payroll managers can update expense claims" on public.expenses;
drop policy if exists "admins and payroll managers can update overtime requests" on public.overtime_requests;

create or replace function public.review_loan(p_loan_id uuid, p_approve boolean)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_instance public.approval_instances;
begin
  select * into v_loan from public.loans where id = p_loan_id and status = 'pending';

  if v_loan.id is null then
    raise exception 'Loan % not found or not pending', p_loan_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'loans' and request_id = p_loan_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (v_loan.org_id, 'loans', p_loan_id, 1, core.approval_total_steps(v_loan.org_id, 'loan'))
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This loan has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_loan.org_id, 'loan', v_loan.employee_id, v_instance.current_step_order) then
    raise exception 'You do not have permission to review this loan at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), case when p_approve then 'approved' else 'rejected' end);

  if not p_approve then
    update public.approval_instances set status = 'rejected' where id = v_instance.id;

    update public.loans
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_loan_id
    returning * into v_loan;

    return v_loan;
  end if;

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_loan;
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  update public.loans
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return v_loan;
end;
$$;

revoke all on function public.review_loan(uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_loan(uuid, boolean) to authenticated;

-- p_taxable is only required — and only ever written — on the call that
-- actually finalizes approval (the single implicit step for every org
-- that hasn't configured multiple, or the last configured step). An
-- intermediate step's approval never touches taxability, since the row
-- stays 'pending' either way and expenses_taxable_matches_status only
-- constrains 'approved'/'paid' rows.
create or replace function public.review_expense(p_expense_id uuid, p_approve boolean, p_taxable boolean default null)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_instance public.approval_instances;
begin
  select * into v_expense from public.expenses where id = p_expense_id and status = 'pending';

  if v_expense.id is null then
    raise exception 'Expense claim % not found or not pending', p_expense_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'expenses' and request_id = p_expense_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (v_expense.org_id, 'expenses', p_expense_id, 1, core.approval_total_steps(v_expense.org_id, 'expense'))
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This expense claim has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_expense.org_id, 'expense', v_expense.employee_id, v_instance.current_step_order) then
    raise exception 'You do not have permission to review this expense claim at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), case when p_approve then 'approved' else 'rejected' end);

  if not p_approve then
    update public.approval_instances set status = 'rejected' where id = v_instance.id;

    update public.expenses
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_expense_id
    returning * into v_expense;

    return v_expense;
  end if;

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_expense;
  end if;

  if p_taxable is null then
    raise exception 'Specify whether this expense claim is taxable when approving it';
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  update public.expenses
  set status = 'approved', taxable = p_taxable, approved_by = auth.uid(), approved_at = now()
  where id = p_expense_id
  returning * into v_expense;

  return v_expense;
end;
$$;

revoke all on function public.review_expense(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.review_expense(uuid, boolean, boolean) to authenticated;

-- p_rate_multiplier_bps mirrors p_taxable's shape: optional, and only
-- ever applied on the call that finalizes approval (an admin can raise
-- it from the default 150 = 1.5x per request, e.g. to 200 for a holiday
-- rate — see 20260723150000_overtime.sql). Left null on that final call,
-- the request's existing rate_multiplier_bps (its default) is kept.
create or replace function public.review_overtime_request(
  p_overtime_request_id uuid,
  p_approve boolean,
  p_rate_multiplier_bps integer default null
)
returns public.overtime_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_overtime public.overtime_requests;
  v_instance public.approval_instances;
begin
  select * into v_overtime from public.overtime_requests where id = p_overtime_request_id and status = 'pending';

  if v_overtime.id is null then
    raise exception 'Overtime request % not found or not pending', p_overtime_request_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'overtime_requests' and request_id = p_overtime_request_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (v_overtime.org_id, 'overtime_requests', p_overtime_request_id, 1, core.approval_total_steps(v_overtime.org_id, 'overtime_request'))
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This overtime request has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_overtime.org_id, 'overtime_request', v_overtime.employee_id, v_instance.current_step_order) then
    raise exception 'You do not have permission to review this overtime request at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), case when p_approve then 'approved' else 'rejected' end);

  if not p_approve then
    update public.approval_instances set status = 'rejected' where id = v_instance.id;

    update public.overtime_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_overtime_request_id
    returning * into v_overtime;

    return v_overtime;
  end if;

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_overtime;
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  update public.overtime_requests
  set
    status = 'approved',
    rate_multiplier_bps = coalesce(p_rate_multiplier_bps, rate_multiplier_bps),
    approved_by = auth.uid(),
    approved_at = now()
  where id = p_overtime_request_id
  returning * into v_overtime;

  return v_overtime;
end;
$$;

revoke all on function public.review_overtime_request(uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.review_overtime_request(uuid, boolean, integer) to authenticated;

-- review_leave_encashment_request(): full redeclare per
-- 20260730000000_new_org_roles.sql (the last migration to touch it),
-- now routed through the same instance-tracking gate as the other four.
create or replace function public.review_leave_encashment_request(p_request_id uuid, p_approve boolean)
returns public.leave_encashment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.leave_encashment_requests;
  v_instance public.approval_instances;
begin
  select * into v_request from public.leave_encashment_requests where id = p_request_id and status = 'pending';

  if v_request.id is null then
    raise exception 'Leave encashment request % not found or not pending', p_request_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'leave_encashment_requests' and request_id = p_request_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (
      v_request.org_id, 'leave_encashment_requests', p_request_id, 1,
      core.approval_total_steps(v_request.org_id, 'leave_encashment_request')
    )
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This leave encashment request has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_request.org_id, 'leave_encashment_request', v_request.employee_id, v_instance.current_step_order) then
    raise exception 'You do not have permission to review this leave encashment request at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), case when p_approve then 'approved' else 'rejected' end);

  if not p_approve then
    update public.approval_instances set status = 'rejected' where id = v_instance.id;

    update public.leave_encashment_requests
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id
    returning * into v_request;

    return v_request;
  end if;

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_request;
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  update public.employees
  set annual_leave_balance_days = annual_leave_balance_days - v_request.days_requested
  where id = v_request.employee_id and annual_leave_balance_days >= v_request.days_requested;

  if not found then
    raise exception 'Employee has insufficient annual leave balance for this request';
  end if;

  update public.leave_encashment_requests
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.review_leave_encashment_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_leave_encashment_request(uuid, boolean) to authenticated;

-- Update the SELECT policy for approval_instances / approval_instance_
-- decisions to also cover the four newly-migrated request tables — the
-- existing policies were hardcoded to leave_requests only.
drop policy if exists "org members can view approval instances for requests they can see" on public.approval_instances;
create policy "org members can view approval instances for requests they can see"
on public.approval_instances for select
to authenticated
using (
  (request_table = 'leave_requests' and exists (select 1 from public.leave_requests lr where lr.id = approval_instances.request_id))
  or (request_table = 'loans' and exists (select 1 from public.loans l where l.id = approval_instances.request_id))
  or (request_table = 'expenses' and exists (select 1 from public.expenses x where x.id = approval_instances.request_id))
  or (request_table = 'overtime_requests' and exists (select 1 from public.overtime_requests o where o.id = approval_instances.request_id))
  or (request_table = 'leave_encashment_requests' and exists (select 1 from public.leave_encashment_requests c where c.id = approval_instances.request_id))
);

drop policy if exists "org members can view approval decisions for requests they can see" on public.approval_instance_decisions;
create policy "org members can view approval decisions for requests they can see"
on public.approval_instance_decisions for select
to authenticated
using (
  exists (
    select 1 from public.approval_instances ai
    where ai.id = approval_instance_decisions.approval_instance_id
  )
);
