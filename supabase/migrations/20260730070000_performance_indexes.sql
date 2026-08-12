-- Performance indexes — closes the gaps found in a full audit of the
-- schema against how the app actually queries it. Every one of these is
-- a column that's genuinely filtered/joined/grouped on by real pages
-- already in production use, not a speculative "index everything" pass:
--
--   journal_entries.entry_date   -- every date-range query on the ledger
--                                  (General Ledger, Profit & Loss, Balance
--                                  Sheet, Budgets) filters on this; only
--                                  org_id was indexed before.
--   ledger_postings.account_code -- every trial balance / P&L / Balance
--                                  Sheet / Budget aggregation groups
--                                  postings by this; only journal_entry_id,
--                                  org_id and employee_id were indexed.
--   employees.department_id      -- department/branch/job-grade filters on
--   employees.branch_id             the employee directory and roster
--   employees.job_grade_id          views had no index to use at all.
--   loan_repayments.org_id       -- every other org-scoped table has this;
--                                  loan_repayments was missed when it was
--                                  added (only loan_id/pay_run_id indexed).
--
-- core.has_org_role() — the RLS helper evaluated on every row of every
-- query in the app — was checked separately and is already well-served by
-- org_memberships' existing unique (org_id, user_id) index; nothing to
-- change there.
--
-- Idempotent (IF NOT EXISTS), matching every migration since
-- 20260730010000: this project's operator applies migrations by hand in
-- the SQL Editor, so a half-applied or repeated run must be safe to redo
-- from the top. Pure index additions — no table, policy or function
-- changes, so this is safe to apply to a live database with existing data.
create index if not exists journal_entries_entry_date_idx on public.journal_entries (entry_date);
create index if not exists ledger_postings_account_code_idx on public.ledger_postings (account_code);
create index if not exists employees_department_id_idx on public.employees (department_id);
create index if not exists employees_branch_id_idx on public.employees (branch_id);
create index if not exists employees_job_grade_id_idx on public.employees (job_grade_id);
create index if not exists loan_repayments_org_id_idx on public.loan_repayments (org_id);
