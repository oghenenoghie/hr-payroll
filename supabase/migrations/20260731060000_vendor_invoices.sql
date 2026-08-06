-- Vendor invoices — feature-backlog.md §1's "Contractor/gig workforce
-- depth" gap: "WHT is handled, but full contractor management... is
-- unscoped." This is the first slice: a vendor catalog plus an invoice
-- record that runs VAT and WHT through packages/compliance's
-- computeVendorInvoiceTotals (see rule-versions/ng-2026.1.ts) instead of
-- letting the app compute or store a rate itself. VAT/WHT categories are
-- stored as plain text, never a hardcoded check constraint — they're
-- rule-version data (see nigeria-statutory-compliance.md's "rules are
-- data, not code" principle), resolved by the compliance engine at
-- creation time, not by the schema.
--
-- Amounts are computed server-side from the submitted subtotal and
-- categories, then persisted alongside the rule_version_id they were
-- computed against (same pattern as pay_runs) — a later rule-version bump
-- must never change the numbers on an already-created invoice.
--
-- Same shape as departments/job_grades: an org-scoped catalog
-- (`vendors`) managed by finance-capable roles. Access follows the
-- existing accountant convention from 20260730000000_new_org_roles.sql
-- ("everywhere payroll_manager appears in a role check, accountant is
-- added alongside it") since vendor invoices are payroll-adjacent
-- financial data, not general HR data — hr_manager is deliberately not
-- included, matching journal_entries/ledger_postings rather than
-- departments/job_grades. No delete policy on vendor_invoices: once
-- created it's an audit record, corrected only via status (draft →
-- issued → paid, or void), never removed — mirrors company_policies'
-- audit-trail treatment, not departments' freely-deletable catalog.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) > 0),
  tin text,
  email text,
  phone text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index vendors_org_id_idx on public.vendors (org_id);

alter table public.vendors enable row level security;

create policy "admins, payroll managers and accountants can view vendors"
on public.vendors for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins, payroll managers and accountants can create vendors"
on public.vendors for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins, payroll managers and accountants can update vendors"
on public.vendors for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins, payroll managers and accountants can delete vendors"
on public.vendors for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "auditors can view vendors"
on public.vendors for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create table public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  invoice_number text,
  invoice_date date not null default current_date,
  description text not null check (char_length(description) > 0),

  -- Resolved by packages/compliance's computeVendorInvoiceTotals against
  -- rule_version_id at creation time — never recomputed in place.
  vat_category text not null,
  wht_category text not null,
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  vat_kobo bigint not null check (vat_kobo >= 0),
  vat_exempt boolean not null default false,
  wht_kobo bigint not null check (wht_kobo >= 0),
  invoice_total_kobo bigint not null check (invoice_total_kobo >= 0),
  net_payable_kobo bigint not null check (net_payable_kobo >= 0),
  rule_version_id text not null,

  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index vendor_invoices_org_id_idx on public.vendor_invoices (org_id);
create index vendor_invoices_vendor_id_idx on public.vendor_invoices (vendor_id);

alter table public.vendor_invoices enable row level security;

create policy "admins, payroll managers and accountants can view vendor invoices"
on public.vendor_invoices for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins, payroll managers and accountants can create vendor invoices"
on public.vendor_invoices for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "admins, payroll managers and accountants can update vendor invoices"
on public.vendor_invoices for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']))
with check (core.has_org_role(org_id, array['admin', 'payroll_manager', 'accountant']));

create policy "auditors can view vendor invoices"
on public.vendor_invoices for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));
