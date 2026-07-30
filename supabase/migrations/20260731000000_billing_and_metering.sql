-- SaaS billing & metering — feature-backlog.md §2's "notable one": the
-- business model is per-employee-per-month, but nothing meters active
-- employees, tracks a plan, or invoices. This is the gap that stops
-- Plutus taking money at all.
--
-- Scope, deliberately: plan catalog, one subscription per org, monthly
-- metered billing periods, and record-only invoices — enough for an
-- admin to see what their org owes and why. Real payment collection
-- (Stripe/Paystack charge, card on file, dunning) is NOT built here; an
-- invoice sits in 'issued' until someone marks it paid. That integration
-- is a distinct, larger piece of work and needs a real payment provider
-- account to build against, not something to fake convincingly.
--
-- Pricing on the two seeded plans is illustrative demo data, like every
-- other fixture in this app (see plutus-payroll-platform skill's "Demo
-- data is demo data" guardrail) — never quote it as real pricing.
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_per_employee_kobo bigint not null check (price_per_employee_kobo > 0),
  max_employees integer check (max_employees is null or max_employees > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, description, price_per_employee_kobo, max_employees) values
  ('core', 'Core', 'Payroll and the compliance engine — PAYE, pension, NHF, NHIS, NSITF, ITF, WHT.', 150000, 100),
  ('growth', 'Growth', 'Everything in Core, plus the full People Operations suite: self-service, leave, loans, benefits, multi-country.', 300000, null)
on conflict (code) do nothing;

create table public.org_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_start date not null,
  current_period_end date not null,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  check (current_period_end > current_period_start)
);

create index org_subscriptions_org_id_idx on public.org_subscriptions (org_id);

-- One closed, metered period per org per month — the thing an invoice is
-- actually generated from. "Metered" (past tense) is deliberate: this
-- table only ever holds a period once it's over and counted, never the
-- still-accruing current period, so a metered count can never change
-- under an already-issued invoice.
create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  period_start date not null,
  period_end date not null,
  metered_employee_count integer not null check (metered_employee_count >= 0),
  amount_kobo bigint not null check (amount_kobo >= 0),
  created_at timestamptz not null default now(),
  unique (org_id, period_start, period_end),
  check (period_end > period_start)
);

create index billing_periods_org_id_idx on public.billing_periods (org_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  billing_period_id uuid not null unique references public.billing_periods (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 0),
  status text not null default 'issued' check (status in ('issued', 'paid', 'void')),
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_org_id_idx on public.invoices (org_id);

alter table public.subscription_plans enable row level security;
alter table public.org_subscriptions enable row level security;
alter table public.billing_periods enable row level security;
alter table public.invoices enable row level security;

-- The plan catalog itself isn't org-scoped data — every signed-in member
-- of any org can see what plans exist (needed to render a pricing/upgrade
-- page), same trust level as "any authenticated user can read public
-- pricing." Only a platform operator (service role, not modelled here as
-- an app-facing role) would ever write to it.
create policy "any authenticated user can view subscription plans"
on public.subscription_plans for select
to authenticated
using (is_active);

create policy "org admins can view their subscription"
on public.org_subscriptions for select
to authenticated
using (core.has_org_role(org_id, array['admin']));

create policy "org admins can view billing periods"
on public.billing_periods for select
to authenticated
using (core.has_org_role(org_id, array['admin']));

create policy "org admins can view invoices"
on public.invoices for select
to authenticated
using (core.has_org_role(org_id, array['admin']));

-- Marking an invoice paid is admin-only and deliberately narrow — only
-- the status/paid_at pair, never amount_kobo (that's fixed at issue
-- time from the metered period it belongs to, and must stay that way
-- for the invoice to mean anything as a record).
create policy "org admins can mark their invoices paid"
on public.invoices for update
to authenticated
using (core.has_org_role(org_id, array['admin']) and status = 'issued')
with check (core.has_org_role(org_id, array['admin']) and status in ('paid', 'void'));

-- Employment-interval reconstruction from employee_status_history (see
-- 20260723240000's log_employee_status_change trigger), not a naive
-- "status = 'active' right now" count — that would undercount anyone who
-- was active for part of the period and has since exited, and
-- overcount/undercount around reinstatement (an employee can leave and
-- come back; account-revoked's own comment already treats that as a
-- real, supported case, not an edge case to ignore).
--
-- 'suspended' counts as billable alongside 'active' — a suspended
-- employee still occupies a seat in the system, they just can't sign in;
-- only 'terminated' actually frees the seat. This is the metering
-- definition feature-backlog.md's SaaS billing section asked to be
-- decided precisely rather than left implicit.
create or replace function core.compute_billable_employee_count(p_org_id uuid, p_period_start date, p_period_end date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  -- Every employee needs a transition row at created_at too, not just
  -- their logged changes — otherwise an employee whose first status_
  -- history row lands mid-year loses their true earlier "active since
  -- created_at" interval entirely (their initial state was never a
  -- *change*, so it's never in employee_status_history). That initial
  -- status is the old_status of their earliest logged transition, or
  -- their current status if they've never had one logged at all.
  with transitions as (
    select
      e.id as employee_id,
      coalesce(
        (
          select h.old_status from public.employee_status_history h
          where h.employee_id = e.id
          order by h.changed_at asc
          limit 1
        ),
        e.status
      ) as status,
      e.created_at::date as effective_date
    from public.employees e
    where e.org_id = p_org_id
    union all
    select h.employee_id, h.new_status as status, h.changed_at::date as effective_date
    from public.employee_status_history h
    join public.employees e on e.id = h.employee_id
    where e.org_id = p_org_id
  ),
  intervals as (
    select
      employee_id,
      status,
      effective_date as interval_start,
      lead(effective_date) over (partition by employee_id order by effective_date) as interval_end
    from transitions
  )
  select count(distinct employee_id)::integer
  from intervals
  where status in ('active', 'suspended')
    and interval_start <= p_period_end
    and (interval_end is null or interval_end > p_period_start);
$$;

revoke all on function core.compute_billable_employee_count(uuid, date, date) from public, anon;
grant execute on function core.compute_billable_employee_count(uuid, date, date) to authenticated;

-- Admin-facing read of the *current, still-open* period's running count
-- and projected charge — never persisted (that only happens at close-out
-- below), so an admin can see today's number without it ever becoming a
-- billable fact until the period actually ends.
create or replace function public.get_current_billing_estimate(p_org_id uuid)
returns table (
  plan_code text,
  plan_name text,
  price_per_employee_kobo bigint,
  max_employees integer,
  period_start date,
  period_end date,
  metered_employee_count integer,
  estimated_amount_kobo bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not core.has_org_role(p_org_id, array['admin']) then
    raise exception 'not authorized';
  end if;

  return query
  select
    sp.code,
    sp.name,
    sp.price_per_employee_kobo,
    sp.max_employees,
    os.current_period_start,
    os.current_period_end,
    core.compute_billable_employee_count(p_org_id, os.current_period_start, os.current_period_end),
    core.compute_billable_employee_count(p_org_id, os.current_period_start, os.current_period_end) * sp.price_per_employee_kobo
  from public.org_subscriptions os
  join public.subscription_plans sp on sp.id = os.plan_id
  where os.org_id = p_org_id;
end;
$$;

revoke all on function public.get_current_billing_estimate(uuid) from public, anon, authenticated;
grant execute on function public.get_current_billing_estimate(uuid) to authenticated;

-- Monthly close-out: for every org whose current_period_end has passed,
-- meter it, write the immutable billing_periods row, issue an invoice
-- (net-14), and roll the subscription into the next calendar month.
-- Mirrors core.check_lifecycle_deadlines()/check_pending_approvals()'s
-- existing pg_cron pattern exactly.
create or replace function core.close_billing_periods()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sub record;
  v_count integer;
  v_amount_kobo bigint;
  v_billing_period_id uuid;
  v_price_per_employee_kobo bigint;
begin
  for v_sub in
    select os.id, os.org_id, os.plan_id, os.current_period_start, os.current_period_end, sp.price_per_employee_kobo
    from public.org_subscriptions os
    join public.subscription_plans sp on sp.id = os.plan_id
    where os.status in ('trialing', 'active', 'past_due')
      and os.current_period_end <= current_date
  loop
    v_count := core.compute_billable_employee_count(v_sub.org_id, v_sub.current_period_start, v_sub.current_period_end);
    v_amount_kobo := v_count * v_sub.price_per_employee_kobo;

    insert into public.billing_periods (org_id, plan_id, period_start, period_end, metered_employee_count, amount_kobo)
    values (v_sub.org_id, v_sub.plan_id, v_sub.current_period_start, v_sub.current_period_end, v_count, v_amount_kobo)
    on conflict (org_id, period_start, period_end) do nothing
    returning id into v_billing_period_id;

    if v_billing_period_id is not null then
      insert into public.invoices (org_id, billing_period_id, amount_kobo, due_at)
      values (v_sub.org_id, v_billing_period_id, v_amount_kobo, now() + interval '14 days');

      insert into public.notifications (org_id, recipient_user_id, type, message, link)
      select v_sub.org_id, m.user_id, 'invoice_issued',
        'A new invoice for ' || v_count || ' employee' || (case when v_count = 1 then '' else 's' end) ||
          ' is ready — ' || (v_amount_kobo / 100.0)::numeric(12, 2) || ' NGN, due in 14 days.',
        '/billing'
      from public.org_memberships m
      where m.org_id = v_sub.org_id and m.role = 'admin';
    end if;

    update public.org_subscriptions
    set
      current_period_start = v_sub.current_period_end,
      current_period_end = (v_sub.current_period_end + interval '1 month')::date,
      status = case when status = 'trialing' then 'active' else status end
    where id = v_sub.id;
  end loop;
end;
$$;

revoke execute on function core.close_billing_periods() from public, anon, authenticated;

select cron.schedule('close-billing-periods', '0 5 * * *', $$select core.close_billing_periods();$$);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'loan_request_submitted', 'loan_approved', 'loan_rejected',
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'benefit_enrolled', 'pay_run_created',
    'overtime_request_submitted', 'overtime_approved', 'overtime_rejected',
    'leave_encashment_submitted', 'leave_encashment_approved', 'leave_encashment_rejected',
    'policy_published', 'contract_expiring', 'probation_ending',
    'approval_pending_reminder', 'invoice_issued'
  ]));

-- Backfill: every org that existed before this migration needs a
-- subscription row too, or the billing dashboard has nothing to show for
-- them and close_billing_periods() silently skips them forever. Started
-- 'active' (not 'trialing' — these are established orgs, not new
-- signups) on the Core plan, current calendar month.
insert into public.org_subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
select
  o.id,
  (select id from public.subscription_plans where code = 'core'),
  'active',
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month')::date
from public.organizations o
where not exists (select 1 from public.org_subscriptions s where s.org_id = o.id);

-- create_organization(): full redeclare, current definition per
-- org_tenant_foundation.sql (the only migration to touch it) — starts
-- every new org on a 14-day trial of the Core plan, atomically, so an
-- org can never exist without a subscription any more than it can exist
-- without an admin.
create or replace function public.create_organization(
  p_name text,
  p_rc_number text default null,
  p_company_tin text default null,
  p_default_pay_frequency text default 'monthly',
  p_default_pfa text default null,
  p_states_of_operation text[] default '{}'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_core_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, rc_number, company_tin, default_pay_frequency, default_pfa, states_of_operation)
  values (p_name, p_rc_number, p_company_tin, p_default_pay_frequency, p_default_pfa, p_states_of_operation)
  returning * into v_org;

  insert into public.org_memberships (org_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  select id into v_core_plan_id from public.subscription_plans where code = 'core';

  insert into public.org_subscriptions (org_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
  values (
    v_org.id,
    v_core_plan_id,
    'trialing',
    now() + interval '14 days',
    current_date,
    (current_date + interval '1 month')::date
  );

  return v_org;
end;
$$;

revoke all on function public.create_organization(text, text, text, text, text, text[]) from public;
grant execute on function public.create_organization(text, text, text, text, text, text[]) to authenticated;
