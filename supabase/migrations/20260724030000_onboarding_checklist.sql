-- Onboarding checklist — the counterpart to employee_offboarding_checklist,
-- closing feature-backlog.md's note that "onboarding's own checklist
-- (documentation, contract signing, probation tracking, confirmation)
-- remains unbuilt." Probation tracking and confirmation already exist as
-- employees.probation_end_date / confirmed; this covers the remaining
-- two manually-tracked steps. Same shape and RLS as the offboarding
-- checklist: one row per employee, admin/HR-editable.
create table public.employee_onboarding_checklist (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  documentation_collected boolean not null default false,
  contract_signed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create index employee_onboarding_checklist_org_id_idx on public.employee_onboarding_checklist (org_id);

alter table public.employee_onboarding_checklist enable row level security;

create policy "admins, HR and payroll managers can view onboarding checklists"
on public.employee_onboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager']));

create policy "admins and HR managers can create onboarding checklists"
on public.employee_onboarding_checklist for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update onboarding checklists"
on public.employee_onboarding_checklist for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));
