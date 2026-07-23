-- Final Settlement: exit payroll. Deliberately reuses the existing
-- create_pay_run() RPC unchanged — a settlement is modelled as a
-- single-employee, off-cycle pay run whose "gross" is leave payout +
-- gratuity (both taxable, so re-taxed through the normal cumulative PAYE
-- bands) and whose loan clearance reuses the existing loan_repayments
-- mechanism verbatim (repayment amount = full outstanding balance, which
-- the existing outstanding_kobo >= 0 check and 'completed' auto-transition
-- already handle correctly with no changes needed).
--
-- hire_date is required to compute service years for gratuity. Nullable —
-- existing employees won't have one until HR backfills it, and a missing
-- hire_date blocks settlement (checked in the application layer, the same
-- style as the TIN gate) rather than defaulting to a guess.
alter table public.employees
  add column hire_date date;

-- Product spec's Create Pay Run form documents "off-cycle" as a frequency
-- alongside monthly/bonus/13th-month/arrears — this is the first feature
-- to actually need it.
alter table public.pay_runs
  drop constraint pay_runs_frequency_check,
  add constraint pay_runs_frequency_check check (frequency in ('weekly', 'biweekly', 'monthly', 'off-cycle'));

-- Not a source of truth for the money (the pay run + payslip + ledger
-- postings already are, via the unmodified create_pay_run path) — this is
-- an audit-friendly summary record and, via the unique employee_id, the
-- idempotency guard that stops the same employee being settled twice.
create table public.final_settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  pay_run_id uuid not null references public.pay_runs (id) on delete cascade,
  service_years numeric not null,
  leave_days_paid numeric not null,
  leave_payout_kobo bigint not null,
  gratuity_kobo bigint not null,
  loan_clearance_kobo bigint not null,
  net_settlement_kobo bigint not null,
  processed_by uuid not null,
  created_at timestamptz not null default now()
);

create index final_settlements_org_id_idx on public.final_settlements (org_id);

alter table public.final_settlements enable row level security;

create policy "admins and payroll managers can view final settlements"
on public.final_settlements for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "admins and payroll managers can record final settlements"
on public.final_settlements for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

create policy "employees can view their own final settlement"
on public.final_settlements for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = final_settlements.employee_id and e.user_id = auth.uid()
  )
);
