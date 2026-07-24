-- Wires the already-computed contract-expiry and probation-ending badges
-- (getContractStatus/getProbationStatus in lib/format.ts, "Ends soon" at 14
-- days) to the existing in-app Notifications system instead of leaving
-- them as page-load-only badges nobody gets pushed a Notification about.
-- feature-backlog.md's "Notifications and alerting" gap calls out contract
-- and probation expiry specifically; this closes that piece without
-- needing the two things still missing for the rest of it (a real
-- background job runner, an outbound email provider) — the check runs
-- on employees list page load, same as every other "computed on page
-- load, not scheduled" pattern in this app.
--
-- notified_at is nullable and only ever set once per approaching deadline
-- (the application checks "is null" before notifying, then sets it) — the
-- trigger below resets it to null whenever the underlying date changes,
-- so extending a contract or probation date re-arms the alert for the new
-- date instead of silently never firing again.
alter table public.employees
  add column contract_expiry_notified_at timestamptz,
  add column probation_expiry_notified_at timestamptz;

create or replace function core.reset_lifecycle_notified_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contract_end_date is distinct from old.contract_end_date then
    new.contract_expiry_notified_at := null;
  end if;
  if new.probation_end_date is distinct from old.probation_end_date then
    new.probation_expiry_notified_at := null;
  end if;
  return new;
end;
$$;

create trigger reset_lifecycle_notified_flags_trigger
before update on public.employees
for each row
execute function core.reset_lifecycle_notified_flags();
