-- Employee status change history — a gap surfaced while scoping
-- feature-backlog.md's SaaS billing/metering section: "'employees' for
-- billing means active in the period ... define it precisely or every
-- invoice is arguable." That precision is impossible today because
-- employees.status is a plain mutable field with no record of *when*
-- it last changed — only its current value. This migration adds that
-- missing history, which is independently useful for HR record-keeping
-- (exact termination dates, not just a static badge) and is the
-- prerequisite billing metering itself does not yet build on — that
-- remains a separate, unbuilt gap.
create table public.employee_status_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index employee_status_history_org_id_idx on public.employee_status_history (org_id);
create index employee_status_history_employee_id_idx on public.employee_status_history (employee_id);

alter table public.employee_status_history enable row level security;

create policy "org staff can view employee status history"
on public.employee_status_history for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'hr_manager']));

-- Auto-logged, never client-inserted — mirrors core.validate_journal_balance's
-- pattern of a security definer trigger function with execute revoked
-- from every role, since only the trigger mechanism itself calls it.
create or replace function core.log_employee_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.employee_status_history (org_id, employee_id, old_status, new_status, changed_by)
    values (new.org_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke execute on function core.log_employee_status_change() from public, anon, authenticated;

create trigger log_employee_status_change_trigger
after update on public.employees
for each row
execute function core.log_employee_status_change();
