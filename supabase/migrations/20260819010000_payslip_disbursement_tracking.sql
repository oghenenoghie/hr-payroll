-- Per-employee disbursement settlement tracking — the piece
-- feature-backlog.md's "Failed payment tracking and reconciliation"
-- explicitly named as still open after the 2026-09-12 disbursement-file
-- export and mark_pay_run_paid(): "nothing records whether an individual
-- line in that exported file actually landed or bounced once sent to the
-- bank; today 'paid' is one flag for the whole run."
--
-- Append-only, same shape and reasoning as statutory_remittances: payslips
-- itself has no update policy anywhere in this build (append-only by RLS
-- design — every correction to a posted run is a new row/reversal, never
-- an edit in place), so a per-employee "did this settle" fact gets its own
-- record table rather than a mutable column bolted onto payslips. A
-- payslip's current disbursement status is derived as "the most recent
-- record for it, if any" (see the view below), never stored redundantly.
create table public.payslip_disbursement_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  payslip_id uuid not null references public.payslips (id) on delete cascade,
  status text not null check (status in ('settled', 'failed')),
  failure_reason text,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint payslip_disbursement_records_failure_reason_check check (
    (status = 'failed' and failure_reason is not null and char_length(trim(failure_reason)) > 0)
    or (status = 'settled')
  )
);

create index payslip_disbursement_records_payslip_id_idx on public.payslip_disbursement_records (payslip_id);
create index payslip_disbursement_records_org_id_idx on public.payslip_disbursement_records (org_id);

alter table public.payslip_disbursement_records enable row level security;

-- Same read scope as statutory_remittances: whoever can already see the
-- pay run itself (admin/payroll_manager via payroll_core, auditor,
-- finance_manager, chro) can see whether a specific employee's transfer
-- settled or bounced.
create policy "payroll-visible roles can view disbursement records"
on public.payslip_disbursement_records for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'payroll_manager', 'auditor', 'finance_manager', 'chro']));

-- No insert/update/delete policy for anyone — every write goes through
-- record_payslip_disbursement_outcome, narrower than who may merely see
-- one (admin/payroll_manager/finance_manager, the same three roles
-- record_statutory_remittance and mark_pay_run_paid already use for "real
-- money moved" record-keeping).
create or replace function public.record_payslip_disbursement_outcome(
  p_payslip_id uuid,
  p_status text,
  p_failure_reason text default null
)
returns public.payslip_disbursement_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payslip public.payslips;
  v_pay_run public.pay_runs;
  v_result public.payslip_disbursement_records;
begin
  if p_status not in ('settled', 'failed') then
    raise exception 'Invalid disbursement status: %', p_status;
  end if;

  if p_status = 'failed' and (p_failure_reason is null or char_length(trim(p_failure_reason)) = 0) then
    raise exception 'A failure reason is required when recording a failed disbursement';
  end if;

  select * into v_payslip from public.payslips where id = p_payslip_id;
  if v_payslip.id is null then
    raise exception 'Payslip % not found', p_payslip_id;
  end if;

  select * into v_pay_run from public.pay_runs where id = v_payslip.pay_run_id;

  if not core.has_org_role(v_payslip.org_id, array['admin', 'payroll_manager', 'finance_manager']) then
    raise exception 'You do not have permission to record a disbursement outcome for this organization';
  end if;

  -- Mirrors the export route's own gate: a draft or validated run was
  -- never disbursed (locking is the earliest point a disbursement file
  -- could have been generated at all), so there's nothing to record yet.
  if v_pay_run.status = 'draft' or v_pay_run.status = 'validated' then
    raise exception 'This pay run has not been locked yet, so nothing has been disbursed to record an outcome for';
  end if;

  insert into public.payslip_disbursement_records (org_id, payslip_id, status, failure_reason, recorded_by)
  values (
    v_payslip.org_id,
    p_payslip_id,
    p_status,
    nullif(trim(p_failure_reason), ''),
    auth.uid()
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_payslip_disbursement_outcome(uuid, text, text) from public, anon;
grant execute on function public.record_payslip_disbursement_outcome(uuid, text, text) to authenticated;

-- Read side: one row per payslip that has ever had an outcome recorded,
-- carrying only the latest one — "distinct on" ordered by created_at desc
-- is the standard Postgres idiom for "most recent row per group," cheaper
-- than a window function here since only the single latest row per
-- payslip_id is ever wanted. security_invoker so it runs under the
-- caller's own payslip_disbursement_records select policy, same pattern
-- as posted_payslips and employees_masked.
create view public.latest_payslip_disbursement_status
with (security_invoker = true)
as
select distinct on (payslip_id)
  payslip_id,
  status,
  failure_reason,
  recorded_by,
  created_at
from public.payslip_disbursement_records
order by payslip_id, created_at desc;
