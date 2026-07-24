-- Company policies with acknowledgement — feature-backlog.md §2's
-- "near-blocking" HR gap. Deliberately narrow: inline text content (no
-- file upload/storage pipeline), a title, and a per-employee
-- acknowledgement timestamp. Editing a policy doesn't force anything
-- server-side — updated_at just moves forward, and the UI flags an
-- acknowledgement as stale whenever acknowledged_at < updated_at, which
-- is enough to surface "needs re-acknowledgment" without a full
-- versioning/history model.
create table public.company_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) > 0),
  content text not null check (char_length(content) > 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index company_policies_org_id_idx on public.company_policies (org_id);

alter table public.company_policies enable row level security;

create policy "org members can view company policies"
on public.company_policies for select
to authenticated
using (core.is_org_member(org_id));

create policy "admins and HR managers can create company policies"
on public.company_policies for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR managers can update company policies"
on public.company_policies for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- One acknowledgement row per employee per policy — re-acknowledging
-- (e.g. after a policy edit) upserts the same row rather than
-- accumulating a history, matching the "flag staleness by timestamp
-- comparison" scope decision above.
create table public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  policy_id uuid not null references public.company_policies (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (policy_id, employee_id)
);

create index policy_acknowledgements_org_id_idx on public.policy_acknowledgements (org_id);
create index policy_acknowledgements_policy_id_idx on public.policy_acknowledgements (policy_id);
create index policy_acknowledgements_employee_id_idx on public.policy_acknowledgements (employee_id);

alter table public.policy_acknowledgements enable row level security;

create policy "employees can view their own policy acknowledgements"
on public.policy_acknowledgements for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = policy_acknowledgements.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and HR managers can view all policy acknowledgements"
on public.policy_acknowledgements for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "employees can acknowledge a policy for themselves"
on public.policy_acknowledgements for insert
to authenticated
with check (
  exists (
    select 1 from public.employees e
    where e.id = policy_acknowledgements.employee_id and e.user_id = auth.uid()
  )
);

create policy "employees can update their own acknowledgement timestamp"
on public.policy_acknowledgements for update
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = policy_acknowledgements.employee_id and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = policy_acknowledgements.employee_id and e.user_id = auth.uid()
  )
);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
  'loan_request_submitted', 'loan_approved', 'loan_rejected',
  'expense_submitted', 'expense_approved', 'expense_rejected',
  'benefit_enrolled',
  'pay_run_created',
  'overtime_request_submitted', 'overtime_approved', 'overtime_rejected',
  'leave_encashment_submitted', 'leave_encashment_approved', 'leave_encashment_rejected',
  'policy_published'
));
