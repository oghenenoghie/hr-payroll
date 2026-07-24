-- Suspended employee status — feature-backlog.md's "Lifecycle state"
-- blocking gap: employees.status previously only supported active and
-- terminated, so a disciplinary or investigatory suspension had no
-- correct representation. Setting status to terminated would wrongly
-- trigger the access-revocation layout gate and make the employee
-- eligible for Final Settlement — both of those checks key specifically
-- off 'terminated' and are untouched by this migration. A suspended
-- employee is simply excluded from regular pay run creation, which
-- already filters on status = 'active' with no query changes needed.
alter table public.employees drop constraint employees_status_check;
alter table public.employees
  add constraint employees_status_check check (status in ('active', 'suspended', 'terminated'));
