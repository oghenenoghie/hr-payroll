-- Statutory-deadline reminders on the daily cron job — the gap the
-- Notifications feature-map entry explicitly disclosed as unbuilt
-- ("Statutory-deadline reminders remain unbuilt"). Reuses the exact
-- remittance-day figures already encoded as account labels by
-- create_organization() (pension_payable "due PFA, before the 7th",
-- paye_payable "before the 10th", nhf_payable "before the 10th",
-- nsitf_payable "before the 16th") rather than inventing new ones —
-- those account labels and this reminder are now two views onto the
-- same four numbers. Scoped to the four schemes actually applied in
-- pay-run postings (PAYE, pension, NHF, NSITF); ITF and WHT are
-- "documented, not yet applied" on /compliance — nothing in this build
-- produces the org turnover/headcount or contractor-payment data a real
-- reminder for either would need, so they're left out rather than
-- reminding against a number nothing backs.
--
-- pension's real deadline is "N working days after payment" and NHF's
-- is "within N month of payment" — both payment-triggered, not calendar
-- -fixed. Approximating both to the fixed day-of-month already used for
-- their account labels is a disclosed simplification, not new: this
-- build has never modeled a remittance being marked paid (the Reports
-- statutory-liability totals are already an all-time cumulative posted
-- figure, not an outstanding/settled split), so a precise payment-
-- triggered deadline has nothing to anchor to that a calendar day
-- doesn't already give it just as well.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'leave_request_submitted',
  'leave_request_approved',
  'leave_request_rejected',
  'loan_request_submitted',
  'loan_approved',
  'loan_rejected',
  'expense_submitted',
  'expense_approved',
  'expense_rejected',
  'benefit_enrolled',
  'pay_run_created',
  'overtime_request_submitted',
  'overtime_approved',
  'overtime_rejected',
  'leave_encashment_submitted',
  'leave_encashment_approved',
  'leave_encashment_rejected',
  'policy_published',
  'contract_expiring',
  'probation_ending',
  'approval_pending_reminder',
  'compensation_updated',
  'performance_goal_assigned',
  'performance_appraisal_submitted',
  'performance_appraisal_acknowledged',
  'interview_scheduled',
  'employee_relations_case_opened',
  'shift_assigned',
  'training_assigned',
  'statutory_deadline_reminder'
));

-- One reminder per org per scheme per deadline month — same shape as
-- core.approval_aging_notified, just keyed on the recurring monthly
-- deadline instead of a one-off request row. Never exposed to
-- PostgREST — lives in core, like the function that writes it.
create table core.statutory_deadline_notified (
  org_id uuid not null references public.organizations (id) on delete cascade,
  scheme text not null,
  deadline_month date not null,
  notified_at timestamptz not null default now(),
  primary key (org_id, scheme, deadline_month)
);

-- Runs daily; only actually fires a reminder on the one day each month
-- that's exactly v_window_days before a given scheme's deadline day, so
-- most runs are a no-op scan. Only reminds an org that has posted (not
-- draft, not reversed) payroll in the last 60 days — an org that's
-- never run payroll, or hasn't in two months, has no fresh statutory
-- liability from this build's own postings to be reminded about.
create or replace function core.check_statutory_deadlines()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_window_days constant int := 5;
  v_scheme record;
  v_reminder_day int;
  v_deadline_month date;
  v_org record;
  v_recipients uuid[];
begin
  for v_scheme in
    select * from (values
      ('paye', 10, 'PAYE', 'FIRS / State IRS'),
      ('pension', 7, 'Pension', 'the PFA'),
      ('nhf', 10, 'NHF', 'FMBN'),
      ('nsitf', 16, 'NSITF', 'NSITF')
    ) as s(scheme, deadline_day, label, authority)
  loop
    v_reminder_day := v_scheme.deadline_day - v_window_days;
    if extract(day from current_date) != v_reminder_day then
      continue;
    end if;

    v_deadline_month := date_trunc('month', current_date)::date;

    for v_org in
      select distinct pr.org_id
      from public.pay_runs pr
      where pr.status = 'posted'
        and pr.period_end >= current_date - 60
        and not exists (
          select 1 from core.statutory_deadline_notified n
          where n.org_id = pr.org_id and n.scheme = v_scheme.scheme and n.deadline_month = v_deadline_month
        )
    loop
      select array_agg(user_id) into v_recipients
      from public.org_memberships
      where org_id = v_org.org_id and role in ('admin', 'payroll_manager', 'finance_manager');

      if v_recipients is not null then
        insert into public.notifications (org_id, recipient_user_id, type, message, link)
        select
          v_org.org_id,
          uid,
          'statutory_deadline_reminder',
          v_scheme.label || ' remittance due to ' || v_scheme.authority || ' by the ' || v_scheme.deadline_day || 'th — '
            || v_window_days || ' day' || (case when v_window_days = 1 then '' else 's' end) || ' left.',
          '/compliance'
        from unnest(v_recipients) as uid;
      end if;

      insert into core.statutory_deadline_notified (org_id, scheme, deadline_month)
      values (v_org.org_id, v_scheme.scheme, v_deadline_month);
    end loop;
  end loop;
end;
$$;

revoke execute on function core.check_statutory_deadlines() from public, anon, authenticated;

select cron.schedule('check-statutory-deadlines', '0 7 * * *', $$select core.check_statutory_deadlines();$$);
