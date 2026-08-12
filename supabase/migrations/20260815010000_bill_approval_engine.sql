-- Routes vendor bill approval through the same configurable
-- approval_workflow_steps engine loans/expenses/overtime/leave
-- encashment already use (20260731040000_migrate_remaining_approval_
-- flows.sql) — Bills was the one workflow module still gated by a
-- bespoke, one-step admin/payroll_manager check baked into RLS instead
-- of the shared engine, per the platform audit.
--
-- Also adds the one thing the engine didn't have yet: an org-configurable
-- amount threshold per step (min_amount_kobo), so an org can require a
-- second approver only above a value they choose — never a hardcoded
-- amount in application code. A step with no threshold always applies;
-- one with a threshold only becomes part of the chain once the bill's
-- amount meets it, so a cheap bill can still clear in one step even when
-- a high-value threshold step is configured.
--
-- Bills have no employee_id the way leave/loans/overtime do, so the
-- reporting_manager/department_manager approver kinds simply never match
-- for request_type = 'bill' (core.is_manager_of(null) is false) — an org
-- configuring bill steps is expected to use 'role' or 'specific_user'.

alter table public.approval_workflow_steps drop constraint if exists approval_workflow_steps_request_type_check;
alter table public.approval_workflow_steps add constraint approval_workflow_steps_request_type_check
  check (request_type in ('leave_request', 'loan', 'expense', 'overtime_request', 'leave_encashment_request', 'bill'));

alter table public.approval_workflow_steps
  add column if not exists min_amount_kobo bigint;
alter table public.approval_workflow_steps drop constraint if exists approval_workflow_steps_min_amount_kobo_check;
alter table public.approval_workflow_steps add constraint approval_workflow_steps_min_amount_kobo_check
  check (min_amount_kobo is null or min_amount_kobo >= 0);

-- core.is_eligible_request_approver() and core.approval_total_steps() gain
-- a trailing p_amount_kobo param (default null, so the four already-
-- migrated flows — which never pass one — are completely unaffected).
-- The parameter list changes, so this is a genuine drop + recreate rather
-- than a same-signature create-or-replace; every existing call site keeps
-- calling with its original 4 (or 2) positional args, which still
-- resolves correctly against the new signature via the trailing default.
drop function if exists core.is_eligible_request_approver(uuid, text, uuid, integer);

create function core.is_eligible_request_approver(
  p_org_id uuid,
  p_request_type text,
  p_employee_id uuid,
  p_step_order integer,
  p_amount_kobo bigint default null
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
            where e.id = p_employee_id and core.is_department_manager_of(e.id)
          )
        );
    end if;

    if p_request_type = 'bill' then
      -- Matches the pre-engine hardcoded check this replaces exactly —
      -- the same set the "admins and payroll managers can update vendor
      -- bills" RLS policy allowed (accountant/auditor can view bills but
      -- never approved them).
      return core.has_org_role(p_org_id, array['admin', 'payroll_manager']);
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
      and (s.min_amount_kobo is null or (p_amount_kobo is not null and p_amount_kobo >= s.min_amount_kobo))
      and (
        (s.approver_kind = 'role' and core.has_org_role(p_org_id, array[s.approver_role]))
        or (s.approver_kind = 'specific_user' and s.approver_user_id = auth.uid())
        or (s.approver_kind = 'reporting_manager' and core.is_manager_of(p_employee_id))
        or (
          s.approver_kind = 'department_manager'
          and exists (
            select 1 from public.employees e
            where e.id = p_employee_id and core.is_department_manager_of(e.id)
          )
        )
      )
  );
end;
$$;

revoke all on function core.is_eligible_request_approver(uuid, text, uuid, integer, bigint) from public, anon;
grant execute on function core.is_eligible_request_approver(uuid, text, uuid, integer, bigint) to authenticated;

drop function if exists core.approval_total_steps(uuid, text);

create function core.approval_total_steps(p_org_id uuid, p_request_type text, p_amount_kobo bigint default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(step_order), 1)
  from public.approval_workflow_steps
  where org_id = p_org_id and request_type = p_request_type
    and (min_amount_kobo is null or (p_amount_kobo is not null and p_amount_kobo >= min_amount_kobo));
$$;

revoke all on function core.approval_total_steps(uuid, text, bigint) from public, anon;
grant execute on function core.approval_total_steps(uuid, text, bigint) to authenticated;

-- core.is_eligible_leave_approver() is a thin wrapper — redeclare with
-- the same body against the new 5-arg signature underneath (leave never
-- passes an amount, so this is unaffected).
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

-- Once approve/reject go through a step-checked, security definer RPC,
-- the blanket direct-UPDATE policy becomes a bypass — exactly the
-- concern 20260731040000 flagged and closed for loans/expenses/overtime.
-- vendor_bills has more mutation RPCs than those tables did (pay,
-- schedule, cancel, batch-pay, on top of approve/reject), so rather than
-- leaving those on the now-dropped policy, every vendor_bills mutation
-- RPC below moves to security definer with its own explicit role check —
-- no direct-UPDATE escape hatch remains for any of them.
drop policy if exists "admins and payroll managers can update vendor bills" on public.vendor_bills;

create or replace function public.approve_vendor_bill(p_bill_id uuid, p_expense_account_code text default 'vendor_expense')
returns public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_instance public.approval_instances;
  v_journal_entry_id uuid;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id and status = 'pending_approval' for update;

  if v_bill.id is null then
    raise exception 'Bill % not found or not pending approval', p_bill_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'vendor_bills' and request_id = p_bill_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (
      v_bill.org_id, 'vendor_bills', p_bill_id, 1,
      core.approval_total_steps(v_bill.org_id, 'bill', v_bill.amount_kobo)
    )
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This bill has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_bill.org_id, 'bill', null, v_instance.current_step_order, v_bill.amount_kobo) then
    raise exception 'You do not have permission to review this bill at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), 'approved');

  if v_instance.current_step_order < v_instance.total_steps then
    update public.approval_instances
    set current_step_order = current_step_order + 1
    where id = v_instance.id;

    return v_bill;
  end if;

  update public.approval_instances set status = 'approved' where id = v_instance.id;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_bill.org_id, 'Vendor bill approved: ' || v_bill.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values
    (v_journal_entry_id, v_bill.org_id, p_expense_account_code, 'debit', v_bill.amount_kobo),
    (v_journal_entry_id, v_bill.org_id, 'accounts_payable', 'credit', v_bill.amount_kobo);

  update public.vendor_bills
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), journal_entry_id = v_journal_entry_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.approve_vendor_bill(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_vendor_bill(uuid, text) to authenticated;

create or replace function public.reject_vendor_bill(p_bill_id uuid)
returns public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_instance public.approval_instances;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id and status = 'pending_approval' for update;

  if v_bill.id is null then
    raise exception 'Bill % not found or not pending approval', p_bill_id;
  end if;

  select * into v_instance
  from public.approval_instances
  where request_table = 'vendor_bills' and request_id = p_bill_id;

  if v_instance.id is null then
    insert into public.approval_instances (org_id, request_table, request_id, current_step_order, total_steps)
    values (
      v_bill.org_id, 'vendor_bills', p_bill_id, 1,
      core.approval_total_steps(v_bill.org_id, 'bill', v_bill.amount_kobo)
    )
    returning * into v_instance;
  end if;

  if v_instance.status <> 'pending' then
    raise exception 'This bill has already been fully decided';
  end if;

  if not core.is_eligible_request_approver(v_bill.org_id, 'bill', null, v_instance.current_step_order, v_bill.amount_kobo) then
    raise exception 'You do not have permission to review this bill at its current approval step';
  end if;

  insert into public.approval_instance_decisions (approval_instance_id, step_order, decided_by, decision)
  values (v_instance.id, v_instance.current_step_order, auth.uid(), 'rejected');

  update public.approval_instances set status = 'rejected' where id = v_instance.id;

  update public.vendor_bills
  set status = 'rejected', approved_by = auth.uid(), approved_at = now()
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.reject_vendor_bill(uuid) from public, anon, authenticated;
grant execute on function public.reject_vendor_bill(uuid) to authenticated;

-- pay_vendor_bill / pay_vendor_bills_batch / schedule_vendor_bill_payment
-- / cancel_vendor_bill: full redeclares, unchanged business logic, moved
-- to security definer with the explicit role check the dropped RLS
-- policy used to provide implicitly. None of these route through the
-- approval engine — they're post-approval actions the engine's
-- multi-step config was never meant to gate, same as before.
create or replace function public.schedule_vendor_bill_payment(p_bill_id uuid, p_payment_date date)
returns public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
begin
  if p_payment_date is null then
    raise exception 'A payment date is required';
  end if;

  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if not core.has_org_role(v_bill.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to schedule payment for this bill';
  end if;
  if v_bill.status <> 'approved' then
    raise exception 'Bill % is not approved (status: %)', p_bill_id, v_bill.status;
  end if;

  update public.vendor_bills
  set status = 'scheduled', scheduled_payment_date = p_payment_date
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.schedule_vendor_bill_payment(uuid, date) from public, anon, authenticated;
grant execute on function public.schedule_vendor_bill_payment(uuid, date) to authenticated;

create or replace function public.pay_vendor_bill(p_bill_id uuid)
returns public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_journal_entry_id uuid;
begin
  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if not core.has_org_role(v_bill.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to pay this bill';
  end if;
  if v_bill.status not in ('approved', 'scheduled') then
    raise exception 'Bill % is not approved or scheduled for payment (status: %)', p_bill_id, v_bill.status;
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (v_bill.org_id, 'Vendor bill paid: ' || v_bill.description, current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, v_bill.org_id, 'accounts_payable', 'debit', v_bill.amount_kobo);

  if v_bill.wht_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, v_bill.org_id, 'cash_and_bank', 'credit', v_bill.net_payable_kobo),
      (v_journal_entry_id, v_bill.org_id, 'wht_payable', 'credit', v_bill.wht_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, v_bill.org_id, 'cash_and_bank', 'credit', v_bill.amount_kobo);
  end if;

  update public.vendor_bills
  set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.pay_vendor_bill(uuid) from public, anon, authenticated;
grant execute on function public.pay_vendor_bill(uuid) to authenticated;

create or replace function public.pay_vendor_bills_batch(p_org_id uuid, p_bill_ids uuid[])
returns setof public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_count int := coalesce(array_length(p_bill_ids, 1), 0);
  v_matched_count int;
  v_total_kobo bigint;
  v_total_wht_kobo bigint;
  v_journal_entry_id uuid;
begin
  if not core.has_org_role(p_org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to pay bills for this organization';
  end if;

  if v_requested_count = 0 then
    raise exception 'Select at least one bill to pay';
  end if;

  select count(*), coalesce(sum(amount_kobo), 0), coalesce(sum(wht_kobo), 0)
    into v_matched_count, v_total_kobo, v_total_wht_kobo
  from public.vendor_bills
  where id = any(p_bill_ids) and org_id = p_org_id and status in ('approved', 'scheduled');

  if v_matched_count <> v_requested_count then
    raise exception 'One or more bills are not approved or scheduled, or do not belong to this organization';
  end if;

  insert into public.journal_entries (org_id, memo, entry_date)
  values (p_org_id, 'Batch payment: ' || v_matched_count || ' vendor bill(s)', current_date)
  returning id into v_journal_entry_id;

  insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
  values (v_journal_entry_id, p_org_id, 'accounts_payable', 'debit', v_total_kobo);

  if v_total_wht_kobo > 0 then
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values
      (v_journal_entry_id, p_org_id, 'cash_and_bank', 'credit', v_total_kobo - v_total_wht_kobo),
      (v_journal_entry_id, p_org_id, 'wht_payable', 'credit', v_total_wht_kobo);
  else
    insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
    values (v_journal_entry_id, p_org_id, 'cash_and_bank', 'credit', v_total_kobo);
  end if;

  return query
    update public.vendor_bills
    set status = 'paid', paid_at = now(), payment_journal_entry_id = v_journal_entry_id
    where id = any(p_bill_ids) and org_id = p_org_id
    returning *;
end;
$$;

revoke all on function public.pay_vendor_bills_batch(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.pay_vendor_bills_batch(uuid, uuid[]) to authenticated;

create or replace function public.cancel_vendor_bill(p_bill_id uuid, p_reason text)
returns public.vendor_bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bill public.vendor_bills;
  v_reversal_journal_entry_id uuid;
  v_orig_posting record;
begin
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to cancel a bill';
  end if;

  select * into v_bill from public.vendor_bills where id = p_bill_id for update;

  if v_bill.id is null then
    raise exception 'Bill % not found', p_bill_id;
  end if;
  if not core.has_org_role(v_bill.org_id, array['admin', 'payroll_manager']) then
    raise exception 'You do not have permission to cancel this bill';
  end if;
  if v_bill.status not in ('pending_approval', 'approved', 'scheduled') then
    raise exception 'Bill % cannot be cancelled from its current status (%)', p_bill_id, v_bill.status;
  end if;

  if v_bill.journal_entry_id is not null then
    insert into public.journal_entries (org_id, memo, entry_date)
    values (v_bill.org_id, 'Vendor bill cancelled: ' || v_bill.description || ' — ' || p_reason, current_date)
    returning id into v_reversal_journal_entry_id;

    for v_orig_posting in
      select account_code, direction, amount_kobo
      from public.ledger_postings
      where journal_entry_id = v_bill.journal_entry_id
    loop
      insert into public.ledger_postings (journal_entry_id, org_id, account_code, direction, amount_kobo)
      values (
        v_reversal_journal_entry_id,
        v_bill.org_id,
        v_orig_posting.account_code,
        case when v_orig_posting.direction = 'debit' then 'credit' else 'debit' end,
        v_orig_posting.amount_kobo
      );
    end loop;
  end if;

  -- A pending_approval bill being cancelled may have an in-flight
  -- approval_instances row (if a multi-step chain had already recorded a
  -- first decision) — close it out the same way a rejection would, so it
  -- doesn't linger as 'pending' forever pointing at a bill that's no
  -- longer reachable through approve/reject.
  update public.approval_instances
  set status = 'rejected'
  where request_table = 'vendor_bills' and request_id = p_bill_id and status = 'pending';

  update public.vendor_bills
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

revoke all on function public.cancel_vendor_bill(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_vendor_bill(uuid, text) to authenticated;

-- Extend approval_instances / approval_instance_decisions visibility to
-- also cover vendor_bills, matching the shape 20260731040000 already
-- used for loans/expenses/overtime_requests/leave_encashment_requests —
-- whoever can already see a bill (admin/payroll_manager/accountant/
-- auditor) can see its approval trail.
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
  or (request_table = 'vendor_bills' and exists (select 1 from public.vendor_bills vb where vb.id = approval_instances.request_id))
);
