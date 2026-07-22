-- Payroll core (README §7, §9, §11, §15 Phase 3): employees with real pay
-- components, pay runs pinned to a rule version, and append-only payslips
-- with a stored derivation trail.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (char_length(full_name) > 0),
  state_of_residence text,
  -- Real per-employee pay components in kobo, stored separately — never a
  -- derived split (README §9). Integer minor units throughout, no floats.
  basic_kobo bigint not null default 0 check (basic_kobo >= 0),
  housing_kobo bigint not null default 0 check (housing_kobo >= 0),
  transport_kobo bigint not null default 0 check (transport_kobo >= 0),
  annual_rent_kobo bigint not null default 0 check (annual_rent_kobo >= 0),
  tin text,
  tin_valid_from date,
  tin_valid_to date,
  pfa text,
  manager_id uuid references public.employees (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'terminated')),
  created_at timestamptz not null default now()
);

create index employees_org_id_idx on public.employees (org_id);
create index employees_manager_id_idx on public.employees (manager_id);

create table public.pay_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  -- Every run pins the rule version it used. Results stay immutable and
  -- reproducible even after the rule set gains a newer version.
  rule_version_id text not null,
  employee_count integer not null default 0,
  gross_kobo bigint not null default 0,
  net_kobo bigint not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index pay_runs_org_id_idx on public.pay_runs (org_id);

-- Append-only: corrections are new records, never edits (README §9).
-- No UPDATE or DELETE policy is defined below on purpose.
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  -- Denormalized from pay_runs so RLS policies here don't need a join.
  org_id uuid not null references public.organizations (id) on delete cascade,

  gross_kobo bigint not null,
  pensionable_kobo bigint not null,
  pension_employee_kobo bigint not null,
  pension_employer_kobo bigint not null,
  nhf_kobo bigint not null,
  rent_relief_kobo bigint not null,
  chargeable_income_kobo bigint not null,
  paye_kobo bigint not null,
  employee_deductions_kobo bigint not null,
  net_kobo bigint not null,

  -- Cumulative YTD inputs this payslip was computed against, stored for
  -- reproducibility/audit even though they're derivable from prior rows.
  cumulative_chargeable_income_before_kobo bigint not null,
  cumulative_paye_paid_before_kobo bigint not null,

  created_at timestamptz not null default now()
);

create index payslips_pay_run_id_idx on public.payslips (pay_run_id);
create index payslips_employee_id_idx on public.payslips (employee_id);
create index payslips_org_id_idx on public.payslips (org_id);

alter table public.employees enable row level security;
alter table public.pay_runs enable row level security;
alter table public.payslips enable row level security;

-- employees: admins and HR manage the roster; payroll managers need to see
-- it to run payroll but don't edit it (README §2 role table).
create policy "org staff can view employees"
on public.employees for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'hr_manager']));

create policy "admins and HR can add employees"
on public.employees for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and HR can update employees"
on public.employees for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- pay_runs: admins and payroll managers create/process runs.
create policy "admins and payroll managers can view pay runs"
on public.pay_runs for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can create pay runs"
on public.pay_runs for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- payslips: same audience as pay runs, append-only.
create policy "admins and payroll managers can view payslips"
on public.payslips for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can create payslips"
on public.payslips for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));
