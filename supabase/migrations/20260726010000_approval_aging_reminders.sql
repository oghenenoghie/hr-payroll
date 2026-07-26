-- Closes the last named gap from feature-backlog.md's "Notifications and
-- alerting" entry: approvals pending aging out. A loan, expense, overtime,
-- leave or leave-encashment request can currently sit in 'pending' status
-- indefinitely with nothing pushing a reminder to whoever needs to act on
-- it — the requester sees it in their own list, but the approver only
-- finds out by opening the relevant admin page. Runs on the same daily
-- pg_cron infrastructure as core.check_lifecycle_deadlines(), staggered by
-- 30 minutes so the two jobs don't insert into notifications at the exact
-- same instant (no real contention either way — just easier to read apart
-- in cron.job_run_details).
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'loan_request_submitted', 'loan_approved', 'loan_rejected',
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'benefit_enrolled', 'pay_run_created',
    'overtime_request_submitted', 'overtime_approved', 'overtime_rejected',
    'leave_encashment_submitted', 'leave_encashment_approved', 'leave_encashment_rejected',
    'policy_published', 'contract_expiring', 'probation_ending',
    'approval_pending_reminder'
  ]));

-- One reminder per request, ever, no matter how long it stays pending —
-- unlike contract/probation's *_notified_at (a nullable column on a row
-- that already exists once per employee), an approval-aging reminder has
-- no natural single column to live on since the same request row is
-- shared by 5 different tables. A generic tracking table keyed by
-- (request_table, request_id) avoids a schema change to all 5 and is
-- simple to extend if a future aging category needs the same pattern.
-- Never exposed to PostgREST — it lives in core, like the functions that
-- read and write it, not public.
create table core.approval_aging_notified (
  request_table text not null,
  request_id uuid not null,
  notified_at timestamptz not null default now(),
  primary key (request_table, request_id)
);

create or replace function core.check_pending_approvals()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_threshold_days constant int := 3;
  v_request record;
  v_recipients uuid[];
begin
  -- loans and expenses and overtime_requests: admin/payroll_manager approve these
  for v_request in
    select 'loans' as request_table, l.id, l.org_id, e.full_name, '/loans' as link
    from public.loans l
    join public.employees e on e.id = l.employee_id
    where l.status = 'pending'
      and l.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'loans' and n.request_id = l.id
      )
    union all
    select 'expenses', x.id, x.org_id, e.full_name, '/expenses'
    from public.expenses x
    join public.employees e on e.id = x.employee_id
    where x.status = 'pending'
      and x.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'expenses' and n.request_id = x.id
      )
    union all
    select 'overtime_requests', o.id, o.org_id, e.full_name, '/overtime'
    from public.overtime_requests o
    join public.employees e on e.id = o.employee_id
    where o.status = 'pending'
      and o.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'overtime_requests' and n.request_id = o.id
      )
    union all
    select 'leave_encashment_requests', c.id, c.org_id, e.full_name, '/leave'
    from public.leave_encashment_requests c
    join public.employees e on e.id = c.employee_id
    where c.status = 'pending'
      and c.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'leave_encashment_requests' and n.request_id = c.id
      )
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_request.org_id and role in ('admin', 'payroll_manager');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select v_request.org_id, uid, 'approval_pending_reminder',
        v_request.full_name || '''s request has been pending ' || v_threshold_days || '+ days — take a look.',
        v_request.link
      from unnest(v_recipients) as uid;
    end if;

    insert into core.approval_aging_notified (request_table, request_id) values (v_request.request_table, v_request.id);
  end loop;

  -- leave_requests: admin/hr_manager approve these, a different role pair
  -- than the four above, so it gets its own loop rather than folding into
  -- the union (the recipient lookup differs, not just the link).
  for v_request in
    select r.id, r.org_id, e.full_name
    from public.leave_requests r
    join public.employees e on e.id = r.employee_id
    where r.status = 'pending'
      and r.created_at <= now() - make_interval(days => v_threshold_days)
      and not exists (
        select 1 from core.approval_aging_notified n
        where n.request_table = 'leave_requests' and n.request_id = r.id
      )
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_request.org_id and role in ('admin', 'hr_manager');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select v_request.org_id, uid, 'approval_pending_reminder',
        v_request.full_name || '''s leave request has been pending ' || v_threshold_days || '+ days — take a look.',
        '/leave'
      from unnest(v_recipients) as uid;
    end if;

    insert into core.approval_aging_notified (request_table, request_id) values ('leave_requests', v_request.id);
  end loop;
end;
$$;

revoke execute on function core.check_pending_approvals() from public, anon, authenticated;

select cron.schedule('check-pending-approvals', '30 6 * * *', $$select core.check_pending_approvals();$$);
