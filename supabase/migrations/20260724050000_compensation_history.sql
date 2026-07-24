-- Mid-month salary change history — feature-backlog.md's "Correctness
-- gaps" section: proration for "Mid-month salary change — split period
-- across two rates" was the one proration case still unbuilt, needing
-- "an effective-dated compensation history model, a larger data-model
-- change than the other [proration] cases." Without this, employees.
-- basic/housing/transport_kobo are plain mutable fields with no record
-- of when a raise or cut took effect, so a pay run spanning the change
-- has no way to know how many days fell under each rate.
--
-- Mirrors employee_status_history's pattern exactly: auto-logged by a
-- security-definer trigger, never client-written. The "effective date"
-- for proration purposes is simply the calendar day the change was
-- saved (changed_at::date) — there is no separate backdated/future-dated
-- effective-date input in the UI, consistent with every other proration
-- case in this engine using an already-recorded date, not an assumption.
create table public.employee_compensation_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  old_basic_kobo bigint not null,
  old_housing_kobo bigint not null,
  old_transport_kobo bigint not null,
  new_basic_kobo bigint not null,
  new_housing_kobo bigint not null,
  new_transport_kobo bigint not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index employee_compensation_history_org_id_idx on public.employee_compensation_history (org_id);
create index employee_compensation_history_employee_id_idx on public.employee_compensation_history (employee_id);

alter table public.employee_compensation_history enable row level security;

-- Compensation is sensitive the same way salary masking treats it: scoped
-- to admin/payroll_manager only, not hr_manager (see 20260723180000's
-- salary_masked column and its "not core.has_org_role(...'admin',
-- 'payroll_manager')" masking rule) — narrower than employee_status_history,
-- which hr_manager can see, because this table's contents are exact pay
-- amounts, not just a status label.
create policy "admin and payroll manager can view compensation history"
on public.employee_compensation_history for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create or replace function core.log_employee_compensation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.basic_kobo is distinct from new.basic_kobo
    or old.housing_kobo is distinct from new.housing_kobo
    or old.transport_kobo is distinct from new.transport_kobo
  then
    insert into public.employee_compensation_history (
      org_id, employee_id,
      old_basic_kobo, old_housing_kobo, old_transport_kobo,
      new_basic_kobo, new_housing_kobo, new_transport_kobo,
      changed_by
    )
    values (
      new.org_id, new.id,
      old.basic_kobo, old.housing_kobo, old.transport_kobo,
      new.basic_kobo, new.housing_kobo, new.transport_kobo,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

revoke execute on function core.log_employee_compensation_change() from public, anon, authenticated;

create trigger log_employee_compensation_change_trigger
after update on public.employees
for each row
execute function core.log_employee_compensation_change();

-- Signed, unlike every other proration/deduction column on payslips: a
-- mid-period raise means the days before the change were over-credited at
-- the new (higher) rate, so this is positive and reduces gross the same
-- way new_hire_proration_deduction_kobo does; a mid-period pay cut means
-- those days were under-credited at the new (lower) rate, so this is
-- negative and gross is increased back up. Zero when no compensation
-- change fell inside the run's period.
alter table public.payslips add column salary_change_adjustment_kobo bigint not null default 0;

