-- Offboarding exit checklist — feature-backlog.md's onboarding/offboarding
-- gap: "notice period, exit checklist, asset return, access revocation,
-- clearance, final settlement, experience letter." Access revocation is
-- already automatic (the layout gate on employees.status = 'terminated')
-- and final settlement already has its own table — this covers the
-- remaining four manually-tracked steps as a single row per employee,
-- checked off by admin/HR. Not built: actually generating or e-signing an
-- experience letter document — this only tracks whether one was issued.
create table public.employee_offboarding_checklist (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  notice_period_served boolean not null default false,
  assets_returned boolean not null default false,
  clearance_obtained boolean not null default false,
  experience_letter_issued boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

create index employee_offboarding_checklist_org_id_idx on public.employee_offboarding_checklist (org_id);

alter table public.employee_offboarding_checklist enable row level security;

create policy "admins, HR and payroll managers can view offboarding checklists"
on public.employee_offboarding_checklist for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager', 'payroll_manager']));

create policy "admins and HR managers can create offboarding checklists"
on public.employee_offboarding_checklist for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update offboarding checklists"
on public.employee_offboarding_checklist for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));
