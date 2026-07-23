-- 13th-month pay run frequency. The Full Feature Map's Earnings
-- Management entry has claimed "bonus, 13th-month, arrears and off-cycle
-- pay run frequencies" as live since the phase that built it, but the
-- pay run creation form only ever offered weekly/biweekly/monthly (plus
-- the off-cycle path final settlement uses) — 13th-month was never
-- actually wired up. This closes that gap; "bonus" (a genuinely
-- discretionary per-employee amount, unlike 13th-month's well-defined
-- one-month-of-basic convention) still needs its own UI design and stays
-- unbuilt, honestly, until then.
alter table public.pay_runs
  drop constraint pay_runs_frequency_check,
  add constraint pay_runs_frequency_check check (frequency in ('weekly', 'biweekly', 'monthly', 'off-cycle', 'thirteenth_month'));
