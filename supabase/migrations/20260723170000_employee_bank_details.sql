-- Employee bank account details — feature-backlog.md §2's "sharpest hole":
-- Direct Deposit & Payments is a documented Feature Map module, but
-- nothing in the model held a bank, NUBAN or account name, so there was
-- no way to actually pay anyone even in principle. This adds storage and
-- capture only; disbursement file generation and bank API calls remain
-- unbuilt and undisclosed as such (Integrations already carries its own
-- "demo, not a real connection" banner for the bank-toggle feature this
-- complements).
--
-- bank_account_number is NUBAN-shaped (exactly 10 digits, the CBN
-- standard) but not validated against a real bank or account-name-match
-- API — see feature-backlog.md §3's "Bank account validation" as the
-- natural next step once this exists to validate. No RLS changes: these
-- are ordinary columns on a table already scoped by the existing
-- employees policies (admin/hr_manager write, org-scoped read).
alter table public.employees
  add column bank_name text,
  add column bank_account_number text check (bank_account_number is null or bank_account_number ~ '^[0-9]{10}$'),
  add column bank_account_name text;
