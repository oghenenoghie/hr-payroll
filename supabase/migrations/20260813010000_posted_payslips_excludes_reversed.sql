-- posted_payslips excluded drafts (status != 'draft') but not reversed
-- runs, so a reversed run's payslip rows leaked through everywhere this
-- view is read: an employee's own payslip list and dashboard "latest
-- payslip" card, the Reports PAYE-by-state breakdown, and the
-- cumulative-PAYE carry-forward lookup a new pay run or Final Settlement
-- seeds itself from. The ledger side of a reversal nets to zero on its
-- own (the reversal posts equal-and-opposite entries against the
-- original), but reversal never touches the payslips table itself — the
-- original row's chargeable_income_kobo/paye_kobo stand exactly as
-- computed, so nothing about a reversed run's payslip figures was ever
-- actually undone the way this view's own comment (and
-- 20260727040000_reversal_restores_side_effects.sql's) claimed.
--
-- get_payroll_register_totals already got this right — status = 'posted'
-- (not != 'draft') — this view is brought in line with that same
-- convention rather than inventing a second one. A reversed run's own
-- detail page and the payroll register still show it in full, unchanged
-- by this migration: both read pay_runs/payslips directly, not through
-- this view.
create or replace view public.posted_payslips
with (security_invoker = true)
as
select p.*
from public.payslips p
join public.pay_runs r on r.id = p.pay_run_id
where r.status = 'posted';
