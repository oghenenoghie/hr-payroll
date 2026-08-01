-- Recurring vendor bills (feature-map gap: "no recurring bills"). A
-- template — vendor, amount, description, cadence, next bill date — that
-- a daily pg_cron job turns into a real vendor_bills row on schedule,
-- landing exactly where a manually-raised bill does: pending_approval,
-- still requiring an admin/payroll_manager to approve and pay it through
-- the existing lifecycle. This only automates *raising* the bill, never
-- its approval or payment — those stay a deliberate human action.
--
-- requested_by on the generated bill is the template's own created_by,
-- not a synthetic "system" user: vendor_bills.requested_by is NOT NULL
-- and there's no system account in this schema, so crediting whoever set
-- up the recurring template as the requester of each instance it produces
-- is the natural reading, and needs no change to vendor_bills itself.
--
-- Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE), matching every migration since 20260730010000:
-- this project's operator applies migrations by hand in the SQL Editor.
create table if not exists public.vendor_bill_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  description text not null check (char_length(description) > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'annually')),
  next_bill_date date not null,
  active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists vendor_bill_templates_org_id_idx on public.vendor_bill_templates (org_id);
create index if not exists vendor_bill_templates_active_next_bill_date_idx
  on public.vendor_bill_templates (active, next_bill_date);

alter table public.vendor_bill_templates enable row level security;

drop policy if exists "admins, payroll managers and accountants can view recurring bills" on public.vendor_bill_templates;
create policy "admins, payroll managers and accountants can view recurring bills"
on public.vendor_bill_templates for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can add recurring bills" on public.vendor_bill_templates;
create policy "admins and payroll managers can add recurring bills"
on public.vendor_bill_templates for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can update recurring bills" on public.vendor_bill_templates;
create policy "admins and payroll managers can update recurring bills"
on public.vendor_bill_templates for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager']));

drop policy if exists "admins and payroll managers can delete recurring bills" on public.vendor_bill_templates;
create policy "admins and payroll managers can delete recurring bills"
on public.vendor_bill_templates for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager']));

-- Not security definer, matching core.check_lifecycle_deadlines
-- (20260724100000): pg_cron jobs in this project run as the role that
-- scheduled them (postgres), which already bypasses RLS as a superuser —
-- the same reason that function writes directly to public.notifications
-- and public.employees with no role check of its own. Execute is revoked
-- from every app-facing role below so it's only ever reachable via cron.
create or replace function core.generate_recurring_vendor_bills()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_template record;
  v_next_date date;
begin
  for v_template in
    select * from public.vendor_bill_templates
    where active = true and next_bill_date <= current_date
  loop
    insert into public.vendor_bills (org_id, vendor_id, bill_date, amount_kobo, description, status, requested_by)
    values (
      v_template.org_id,
      v_template.vendor_id,
      v_template.next_bill_date,
      v_template.amount_kobo,
      v_template.description,
      'pending_approval',
      v_template.created_by
    );

    v_next_date := (case v_template.cadence
      when 'weekly' then v_template.next_bill_date + interval '7 days'
      when 'monthly' then v_template.next_bill_date + interval '1 month'
      when 'quarterly' then v_template.next_bill_date + interval '3 months'
      when 'annually' then v_template.next_bill_date + interval '1 year'
      else v_template.next_bill_date + interval '1 month'
    end)::date;

    update public.vendor_bill_templates set next_bill_date = v_next_date where id = v_template.id;
  end loop;
end;
$$;

revoke execute on function core.generate_recurring_vendor_bills() from public, anon, authenticated;

select cron.schedule('generate-recurring-vendor-bills', '0 6 * * *', $$select core.generate_recurring_vendor_bills();$$);
