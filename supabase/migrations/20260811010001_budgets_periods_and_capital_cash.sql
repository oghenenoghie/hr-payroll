-- Budgets v2: per-line periods (unlocks monthly/quarterly breakdown) plus
-- capital and cash budget types alongside the existing operating
-- (revenue/expense) type — the two gaps 20260730060000_budgets.sql
-- explicitly disclosed as not built.
--
-- Every budget_line now carries its own period_start/period_end (a
-- sub-range within its parent budget's overall period) instead of
-- implicitly covering the whole budget period. Existing lines are
-- backfilled to their parent budget's own period_start/period_end,
-- which is exactly what they meant before this migration — a single
-- line spanning the whole period is still the default shape for a
-- budget nobody has broken into months/quarters, this just makes that
-- explicit instead of implicit. The old unique(budget_id, account_code)
-- constraint is what actually blocked a monthly/quarterly breakdown —
-- replaced with unique(budget_id, account_code, period_start,
-- period_end) so the same account can carry one line per sub-period.
alter table public.budget_lines add column if not exists period_start date;
alter table public.budget_lines add column if not exists period_end date;

update public.budget_lines bl
set period_start = b.period_start, period_end = b.period_end
from public.budgets b
where bl.budget_id = b.id and bl.period_start is null;

alter table public.budget_lines alter column period_start set not null;
alter table public.budget_lines alter column period_end set not null;

alter table public.budget_lines drop constraint if exists budget_lines_period_check;
alter table public.budget_lines add constraint budget_lines_period_check check (period_end >= period_start);

alter table public.budget_lines drop constraint if exists budget_lines_budget_id_account_code_key;
alter table public.budget_lines drop constraint if exists budget_lines_budget_id_account_code_period_key;
alter table public.budget_lines add constraint budget_lines_budget_id_account_code_period_key
  unique (budget_id, account_code, period_start, period_end);

-- Capital and cash budgets alongside the existing operating (revenue/
-- expense) type. budget_type is a label the application uses to decide
-- which account types are valid for a line and which actuals sign
-- convention applies — validated in the application layer, same as the
-- account_code type check 20260730060000_budgets.sql already
-- established (account_code is deliberately not FK-constrained to
-- chart_of_accounts either). A capital budget's lines are asset
-- accounts (planned capital expenditure); a cash budget's lines are
-- liability accounts plus cash_and_bank itself (planned obligations and
-- cash position) — the same debit-positive/credit-positive sign
-- convention the Balance Sheet already uses per account.type, just
-- reused here instead of reinvented.
alter table public.budgets add column if not exists budget_type text not null default 'operating'
  check (budget_type in ('operating', 'capital', 'cash'));
