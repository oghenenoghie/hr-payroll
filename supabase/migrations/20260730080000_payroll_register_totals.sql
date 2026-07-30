-- Payroll register totals — part of the performance pass that added
-- pagination to reports/register: that page's pay_runs list is now
-- paginated, but the "Totals (posted runs only)" footer still needs to
-- sum PAYE/pension/NHF liability across every posted run in the org's
-- history, not just the rows on the current page. Downloading every
-- payslip in the org just to sum three columns in JavaScript is exactly
-- the "aggregate in the browser" anti-pattern this whole pass is fixing
-- elsewhere — this function does the same sum in Postgres instead, where
-- it's one indexed pass over payslips rather than a full-table download.
--
-- gross_kobo/net_kobo come straight off pay_runs (cheap, one row per run);
-- paye/pension/nhf need a join to payslips (one row per employee per run)
-- — kept as independent subqueries rather than one joined aggregate so a
-- run with many employees can't fan out and inflate the gross/net sums.
--
-- security invoker, like every other atomic function in this build:
-- pay_runs and payslips already have their own RLS restricting reads to
-- admin/payroll_manager, so this function grants no privilege beyond
-- what the caller's own role already has — no manual authorization check
-- needed inside it.
--
-- Idempotent (create or replace), matching every migration since
-- 20260730010000: this project's operator applies migrations by hand in
-- the SQL Editor, so a half-applied or repeated run must be safe to redo
-- from the top.
create or replace function public.get_payroll_register_totals(p_org_id uuid)
returns table (
  gross_kobo bigint,
  net_kobo bigint,
  paye_kobo bigint,
  pension_kobo bigint,
  nhf_kobo bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    coalesce((select sum(pr.gross_kobo) from public.pay_runs pr where pr.org_id = p_org_id and pr.status = 'posted'), 0)::bigint as gross_kobo,
    coalesce((select sum(pr.net_kobo) from public.pay_runs pr where pr.org_id = p_org_id and pr.status = 'posted'), 0)::bigint as net_kobo,
    coalesce(
      (select sum(ps.paye_kobo) from public.payslips ps join public.pay_runs pr on pr.id = ps.pay_run_id where pr.org_id = p_org_id and pr.status = 'posted'),
      0
    )::bigint as paye_kobo,
    coalesce(
      (select sum(ps.pension_employee_kobo) + sum(ps.pension_employer_kobo) from public.payslips ps join public.pay_runs pr on pr.id = ps.pay_run_id where pr.org_id = p_org_id and pr.status = 'posted'),
      0
    )::bigint as pension_kobo,
    coalesce(
      (select sum(ps.nhf_kobo) from public.payslips ps join public.pay_runs pr on pr.id = ps.pay_run_id where pr.org_id = p_org_id and pr.status = 'posted'),
      0
    )::bigint as nhf_kobo;
$$;

revoke all on function public.get_payroll_register_totals(uuid) from public;
grant execute on function public.get_payroll_register_totals(uuid) to authenticated;
