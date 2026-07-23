-- Discretionary bonus pay runs: an admin-entered, per-employee lump sum
-- (unlike 13th Month, which is auto-computed from basic salary). Reuses
-- deriveLumpSumPayslip(kind: "bonus") — already implemented and golden-
-- tested — so this is purely a new frequency value plus new UI/wiring.
alter table public.pay_runs
  drop constraint pay_runs_frequency_check,
  add constraint pay_runs_frequency_check
    check (frequency in ('weekly', 'biweekly', 'monthly', 'off-cycle', 'thirteenth_month', 'bonus'));
