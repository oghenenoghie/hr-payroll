-- Full pay-run locking lifecycle — feature-backlog.md §1's "Payroll
-- locking and finalisation": "Full preview -> validated -> locked -> paid
-- staging, and rule-version freezing on lock, remain unbuilt; today it's a
-- two-state draft -> posted gate with discard as the escape hatch."
--
-- "preview" needs no schema change: it's the payroll/new form itself,
-- computed client/server-side before create_pay_run is ever called — there
-- is nothing to persist for a run that doesn't exist yet.
--
-- The other three stages are real, but deliberately mapped onto the
-- existing schema rather than a wholesale status rename:
--
--   validated: a genuinely new status value, inserted between draft and
--   today's terminal state. draft -> validated via the new
--   validate_pay_run(), which does everything approve_pay_run() used to
--   (the variance-flag acknowledgment gate) plus a fresh TIN re-check
--   against current employee records — closing the gap where an
--   employee's TIN could be cleared *after* the app-level checkTinGate ran
--   at draft-creation time but *before* the run is finalised. Matches
--   checkTinGate's own rule exactly (presence only, not tin_valid_to/
--   tin_valid_from expiry — this build has never enforced those dates
--   anywhere else, and inventing a stricter rule here alone would be a
--   new, undisclosed policy rather than a re-check of an existing one).
--
--   locked: NOT a fourth status value. "posted" already means exactly
--   this — final, reported, and (after this migration) rule-version-
--   immutable — and at least ten call sites across reports, tax
--   certificates, the dashboard and notifications already read
--   status = 'posted' directly against public.pay_runs, not only through
--   posted_payslips. Renaming that value would mean auditing and touching
--   every one of them for zero behavioural gain. Instead, validated ->
--   locked is the new lock_pay_run(), which does what approve_pay_run()
--   used to finish with: stamp status = 'posted', approved_by, approved_at
--   (those columns already meant "the moment this run became final" —
--   they just gain a real predecessor gate now). A trigger below makes
--   rule_version_id genuinely immutable from that point on, which is the
--   part of "locked" that didn't exist in any form before this migration.
--
--   paid: tracked as disbursed_by/disbursed_at columns on pay_runs, not a
--   status value — for the same reason as locked. A posted run that's
--   been marked paid is still status = 'posted' to every existing reader;
--   disbursed_at is purely additive information layered on top. This also
--   closes half of the separate "Failed payment tracking and
--   reconciliation" backlog gap (disbursement files were generated but
--   nothing tracked what actually settled) — not a scope expansion, since
--   "paid" has no meaning at all without somewhere to record it.
--
-- approve_pay_run(uuid, boolean) is dropped outright, not kept alongside
-- the new functions: leaving it callable would let a caller skip the new
-- TIN re-check entirely by going straight from draft to posted.
drop function if exists public.approve_pay_run(uuid, boolean);

alter table public.pay_runs drop constraint pay_runs_status_check;
alter table public.pay_runs add constraint pay_runs_status_check
  check (status = any (array['draft', 'validated', 'posted', 'reversed']));

alter table public.pay_runs
  add column validated_by uuid references auth.users (id),
  add column validated_at timestamptz,
  add column disbursed_by uuid references auth.users (id),
  add column disbursed_at timestamptz;

-- A validated-but-not-yet-locked run is real (it has payslips and ledger
-- postings, same as a draft) but still isn't final — it must stay
-- invisible to reports/reconciliation/tax certificates/GL export exactly
-- like a draft is, until lock_pay_run() actually posts it. The view
-- already reads status = 'posted' exactly (20260813010000, not != 'draft'
-- — that migration deliberately moved off != 'draft' because it silently
-- re-included reversed runs), so 'validated' is already excluded by that
-- same exact-match convention with no further change needed here; this
-- redeclare exists only so the reasoning above is recorded alongside the
-- rest of this migration; the where clause itself is unchanged.
create or replace view public.posted_payslips
with (security_invoker = true)
as
select p.*
from public.payslips p
join public.pay_runs r on r.id = p.pay_run_id
where r.status = 'posted';

-- draft -> validated. Permission and variance-acknowledgment logic copied
-- verbatim from the approve_pay_run() this replaces (20260731030000); only
-- the target status and the new TIN re-check are new.
create or replace function public.validate_pay_run(p_pay_run_id uuid, p_acknowledge_variance boolean default false)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
  v_unacknowledged_count integer;
  v_missing_tin_names text;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to validate a pay run for this organization';
  end if;

  if v_pay_run.status != 'draft' then
    raise exception 'Only a draft pay run can be validated';
  end if;

  -- Hard stop, no acknowledgment override — matches checkTinGate's own
  -- rule (presence only) and the non-negotiable "never let a run proceed
  -- silently for a TIN-less employee." The app-level gate already ran at
  -- draft-creation time; this re-checks in case a TIN was cleared since.
  select string_agg(e.full_name, ', ' order by e.full_name)
  into v_missing_tin_names
  from public.payslips p
  join public.employees e on e.id = p.employee_id
  where p.pay_run_id = p_pay_run_id
    and (e.tin is null or char_length(trim(e.tin)) = 0);

  if v_missing_tin_names is not null then
    raise exception 'Cannot validate: missing TIN for %. Every employee must have a Tax Identification Number before this run can proceed.', v_missing_tin_names;
  end if;

  select count(*) into v_unacknowledged_count
  from public.pay_run_variance_flags
  where pay_run_id = p_pay_run_id and acknowledged_by is null;

  if v_unacknowledged_count > 0 and not p_acknowledge_variance then
    raise exception 'This run has % unreviewed variance flag(s) — review them, then validate again to acknowledge and proceed', v_unacknowledged_count;
  end if;

  if v_unacknowledged_count > 0 then
    update public.pay_run_variance_flags
    set acknowledged_by = auth.uid(), acknowledged_at = now()
    where pay_run_id = p_pay_run_id and acknowledged_by is null;
  end if;

  update public.pay_runs
  set status = 'validated', validated_by = auth.uid(), validated_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.validate_pay_run(uuid, boolean) from public, anon;
grant execute on function public.validate_pay_run(uuid, boolean) to authenticated;

-- validated -> locked (stored as status = 'posted' — see comment above).
-- Nothing left to check here: validate_pay_run() already cleared TIN and
-- variance; locking is purely "make it final."
create or replace function public.lock_pay_run(p_pay_run_id uuid)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'accountant']) then
    raise exception 'You do not have permission to lock a pay run for this organization';
  end if;

  if v_pay_run.status != 'validated' then
    raise exception 'Only a validated pay run can be locked';
  end if;

  update public.pay_runs
  set status = 'posted', approved_by = auth.uid(), approved_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.lock_pay_run(uuid) from public, anon;
grant execute on function public.lock_pay_run(uuid) to authenticated;

-- locked -> paid. Same role set as record_statutory_remittance (the other
-- "real money moved" record-keeping action) — narrower than who can merely
-- view the run. Idempotent by construction: a second call fails cleanly
-- rather than silently overwriting who/when it was first marked.
create or replace function public.mark_pay_run_paid(p_pay_run_id uuid)
returns public.pay_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay_run public.pay_runs;
begin
  select * into v_pay_run from public.pay_runs where id = p_pay_run_id;

  if v_pay_run.id is null then
    raise exception 'Pay run % not found', p_pay_run_id;
  end if;

  if not core.has_org_role(v_pay_run.org_id, array['admin', 'payroll_manager', 'finance_manager']) then
    raise exception 'You do not have permission to mark a pay run as paid for this organization';
  end if;

  if v_pay_run.status != 'posted' then
    raise exception 'Only a locked (posted) pay run can be marked paid';
  end if;

  if v_pay_run.disbursed_at is not null then
    raise exception 'This pay run was already marked paid';
  end if;

  update public.pay_runs
  set disbursed_by = auth.uid(), disbursed_at = now()
  where id = p_pay_run_id
  returning * into v_pay_run;

  return v_pay_run;
end;
$$;

revoke all on function public.mark_pay_run_paid(uuid) from public, anon;
grant execute on function public.mark_pay_run_paid(uuid) to authenticated;

-- Rule-version freezing on lock: the part of "locked" with no prior
-- enforcement at all. rule_version_id has always been stamped once at
-- create_pay_run() and no UI path ever offered to change it afterward, but
-- nothing in the database actually forbade it. This makes the invariant
-- real instead of merely conventional, from the moment a run is locked
-- (status = 'posted') onward — draft and validated runs can still have
-- rule_version_id corrected if, e.g., a run was created against the wrong
-- version by mistake before anyone reviewed it.
create or replace function core.prevent_rule_version_change_once_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('posted', 'reversed') and new.rule_version_id is distinct from old.rule_version_id then
    raise exception 'rule_version_id is frozen once a pay run is locked and cannot be changed (pay run %)', old.id;
  end if;
  return new;
end;
$$;

create trigger prevent_rule_version_change_once_locked
before update on public.pay_runs
for each row
execute function core.prevent_rule_version_change_once_locked();
