-- Advisor finding: pay_runs.created_by (FK to auth.users) had no covering index.
create index pay_runs_created_by_idx on public.pay_runs (created_by);
