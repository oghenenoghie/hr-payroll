-- Roles & permissions registry (design spec §01, §05, §09).
--
-- org_memberships.role stays a `text` column with the exact same values it
-- already has — every existing RLS policy (core.has_org_role) and every
-- existing app-code comparison (`.eq("role", "admin")`,
-- `membership.role === "admin"`) keeps working unchanged. What changes is
-- where that text is allowed to come from: instead of a hardcoded 4-value
-- CHECK constraint that needs a migration every time a role is added, it's
-- now a foreign key into a real `roles` table, so a new role is a data
-- change (see the seed insert below), not a schema change.
--
-- Global reference data, not org-scoped: roles and permissions are the
-- same across every organization on the platform, so unlike every other
-- table in this schema these carry no org_id.
create table public.roles (
  key text primary key,
  label text not null,
  mfa_required boolean not null default false,
  sort_order int not null
);

create table public.permissions (
  key text primary key,
  module text not null,
  label text not null
);

-- Default capability set per role. Nothing in the app reads this table yet
-- — role checks throughout the codebase still gate on org_memberships.role
-- directly — this seeds the fine-grained side of the "coarse role, fine
-- permission" model (design spec §01) for the permission-check work that
-- follows this migration.
create table public.role_permissions (
  role_key text not null references public.roles (key) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_key, permission_key)
);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

-- Read-only from the API for every signed-in user, on all three tables:
-- role/permission labels need to be visible wherever a role picker or a
-- permission-gated UI renders. No insert/update/delete policy exists on
-- any of them, so they're only ever changed by a migration — deliberately
-- not a super-admin-editable surface yet.
create policy "authenticated users can view roles"
on public.roles for select
to authenticated
using (true);

create policy "authenticated users can view permissions"
on public.permissions for select
to authenticated
using (true);

create policy "authenticated users can view role permissions"
on public.role_permissions for select
to authenticated
using (true);

insert into public.roles (key, label, mfa_required, sort_order) values
  ('admin', 'Super Admin', true, 0),
  ('payroll_manager', 'Payroll Manager', true, 1),
  ('hr_manager', 'HR Manager', false, 2),
  ('accountant', 'Accountant', false, 3),
  ('department_manager', 'Department Manager', false, 4),
  ('employee', 'Employee', false, 5),
  ('auditor', 'Auditor', false, 6);

insert into public.permissions (key, module, label) values
  ('users.manage', 'access', 'Create, edit and deactivate accounts'),
  ('roles.assign', 'access', 'Change a member''s role'),
  ('audit.read', 'access', 'Read the audit log'),
  ('employee.record.view', 'employees', 'View employee records'),
  ('employee.record.edit', 'employees', 'Create and edit employee records'),
  ('employee.record.view.department', 'employees', 'View employee records within own department'),
  ('salary.view.unmasked', 'employees', 'View salary figures where masking would otherwise apply'),
  ('payroll.run.create', 'payroll', 'Create a pay run'),
  ('payroll.run.approve', 'payroll', 'Approve, discard or reverse a pay run'),
  ('payroll.structure.edit', 'payroll', 'Edit salary structure and compensation'),
  ('leave.approve', 'workflow', 'Approve leave, loan, expense and overtime requests'),
  ('leave.approve.department', 'workflow', 'Approve requests within own department only'),
  ('policies.manage', 'hr', 'Author and publish company policies'),
  ('benefits.manage', 'hr', 'Manage benefit plans and enrollment'),
  ('reports.export', 'reports', 'Export statutory and payroll reports');

insert into public.role_permissions (role_key, permission_key)
values
  -- Super Admin: everything.
  ('admin', 'users.manage'), ('admin', 'roles.assign'), ('admin', 'audit.read'),
  ('admin', 'employee.record.view'), ('admin', 'employee.record.edit'), ('admin', 'salary.view.unmasked'),
  ('admin', 'payroll.run.create'), ('admin', 'payroll.run.approve'), ('admin', 'payroll.structure.edit'),
  ('admin', 'leave.approve'), ('admin', 'policies.manage'), ('admin', 'benefits.manage'), ('admin', 'reports.export'),
  -- Payroll Manager: pay runs and compensation, not HR-only records.
  ('payroll_manager', 'employee.record.view'), ('payroll_manager', 'payroll.run.create'),
  ('payroll_manager', 'payroll.run.approve'), ('payroll_manager', 'payroll.structure.edit'),
  ('payroll_manager', 'leave.approve'), ('payroll_manager', 'reports.export'),
  -- HR Manager: employee lifecycle, leave, policies — no pay-run actions.
  ('hr_manager', 'employee.record.view'), ('hr_manager', 'employee.record.edit'),
  ('hr_manager', 'leave.approve'), ('hr_manager', 'policies.manage'), ('hr_manager', 'benefits.manage'),
  -- Accountant: read and export only.
  ('accountant', 'employee.record.view'), ('accountant', 'reports.export'),
  -- Department Manager: own department's roster and approvals only.
  ('department_manager', 'employee.record.view.department'), ('department_manager', 'leave.approve.department'),
  -- Employee: self-service, no listed permissions here (own-record access is
  -- enforced by existing `user_id = auth.uid()` RLS policies, not this table).
  -- Auditor: read everything, write nothing.
  ('auditor', 'employee.record.view'), ('auditor', 'audit.read'), ('auditor', 'reports.export');

-- org_memberships.role now must be a real role key. Data already satisfies
-- this (the only four values ever written are the four seeded above), so
-- the swap is a pure constraint change, no backfill needed.
alter table public.org_memberships drop constraint org_memberships_role_check;
alter table public.org_memberships
  add constraint org_memberships_role_fkey foreign key (role) references public.roles (key);
