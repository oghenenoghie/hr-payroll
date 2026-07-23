-- Final Settlement previously covered only leave payout + gratuity: an
-- employee terminated mid-period was never paid their regular basic /
-- housing / transport for the days actually worked in that final,
-- unfinished period (regular pay runs exclude terminated employees, so
-- nothing else ever picked this up either). These columns record that
-- stub period's derivation on the settlement's audit-friendly summary row
-- (final_settlements is "not a source of truth for the money", per the
-- original migration's comment, but the record should still disclose what
-- was actually paid) -- the money itself lives, as always, in the
-- payslip + ledger postings created by the same create_pay_run() call.
alter table public.final_settlements
  add column final_period_days_worked integer not null default 0,
  add column final_period_gross_kobo bigint not null default 0;
