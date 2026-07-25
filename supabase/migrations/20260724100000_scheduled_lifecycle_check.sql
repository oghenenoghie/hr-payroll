-- A set-based, all-orgs version of the TypeScript notifyLifecycleDeadlines
-- (lib/lifecycle-alerts.ts), now runnable on a real schedule instead of
-- only when someone happens to load the employees list page. Both paths
-- share the same idempotent *_notified_at columns, so whichever runs
-- first for a given employee "wins" — the other simply finds no
-- candidates left. This is the first thing in this app that runs
-- independently of a user request; every other "computed on page load"
-- disclosure in the Feature Map predates pg_cron existing here.
create or replace function core.check_lifecycle_deadlines()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_window_date date := current_date + 14;
  v_employee record;
  v_recipients uuid[];
begin
  for v_employee in
    select id, org_id, full_name, contract_end_date
    from public.employees
    where status = 'active'
      and employment_type != 'permanent'
      and contract_end_date is not null
      and contract_end_date <= v_window_date
      and contract_expiry_notified_at is null
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_employee.org_id and role in ('admin', 'hr_manager');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select
        v_employee.org_id,
        uid,
        'contract_expiring',
        v_employee.full_name || '''s contract ends ' || v_employee.contract_end_date || ' — renew or process termination.',
        '/employees/' || v_employee.id || '/edit'
      from unnest(v_recipients) as uid;
    end if;

    update public.employees set contract_expiry_notified_at = now() where id = v_employee.id;
  end loop;

  for v_employee in
    select id, org_id, full_name, probation_end_date
    from public.employees
    where status = 'active'
      and confirmed = false
      and probation_end_date is not null
      and probation_end_date <= v_window_date
      and probation_expiry_notified_at is null
  loop
    select array_agg(user_id) into v_recipients
    from public.org_memberships
    where org_id = v_employee.org_id and role in ('admin', 'hr_manager');

    if v_recipients is not null then
      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select
        v_employee.org_id,
        uid,
        'probation_ending',
        v_employee.full_name || '''s probation ends ' || v_employee.probation_end_date || ' — confirm or extend.',
        '/employees/' || v_employee.id || '/edit'
      from unnest(v_recipients) as uid;
    end if;

    update public.employees set probation_expiry_notified_at = now() where id = v_employee.id;
  end loop;
end;
$$;

revoke execute on function core.check_lifecycle_deadlines() from public, anon, authenticated;

select cron.schedule('check-lifecycle-deadlines', '0 6 * * *', $$select core.check_lifecycle_deadlines();$$);
