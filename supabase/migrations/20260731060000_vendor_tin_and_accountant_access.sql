-- Two independent branches both built vendor invoicing with VAT/WHT
-- computed via packages/compliance's computeVendorInvoiceTotals: this
-- branch as a standalone `vendor_invoices` table + /vendor-invoices UI,
-- the other as an extension of the already-shipped `vendor_bills` /
-- Bills (AP) module (20260811010000_vendor_bill_vat_wht.sql), which is
-- more mature (approve/reject/pay, batch payment, recurring bills,
-- already surfaced on the dashboard's VAT & WHT widget) and was updated
-- more recently. Rather than ship two parallel tables that let the same
-- kind of financial record be created through two different code paths
-- with two different schemas — a real audit/correctness risk for a
-- payroll/compliance system — `vendor_bills` (via Bills) is kept as the
-- single canonical vendor-invoicing feature and the standalone
-- `vendor_invoices` table/UI is dropped. This migration keeps only the
-- two things from that branch's work which are genuinely additive to
-- the surviving `vendors` catalog:
--
--   1. A `tin` column — useful for WHT remittance/certificate purposes
--      (see nigeria-statutory-compliance.md's contractor-withholding
--      requirement) and already wired into the vendors UI (TinBadge).
--   2. Widening vendor management to include 'accountant', which
--      20260730000000_new_org_roles.sql already established as the
--      rule for every payroll_manager check ("everywhere payroll_manager
--      appears in a role check, accountant is added alongside it") —
--      accounts_payable.sql (20260730010000) predates that migration
--      and never got the widening applied to vendors specifically.
--
-- Idempotent throughout, matching every migration since 20260730010000:
-- this project's operator applies migrations by hand in the SQL Editor.
alter table public.vendors add column if not exists tin text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendors_org_id_name_key'
  ) then
    alter table public.vendors add constraint vendors_org_id_name_key unique (org_id, name);
  end if;
end $$;

drop policy if exists "admins and payroll managers can add vendors" on public.vendors;
create policy "admins and payroll managers can add vendors"
on public.vendors for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can update vendors" on public.vendors;
create policy "admins and payroll managers can update vendors"
on public.vendors for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

drop policy if exists "admins and payroll managers can delete vendors" on public.vendors;
create policy "admins and payroll managers can delete vendors"
on public.vendors for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));
