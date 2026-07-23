-- Notifications: "System events as they happen across the platform." A
-- plain event log keyed to a recipient user, populated as a side effect of
-- existing actions (submit/approve/reject a leave/loan/expense request,
-- enroll in a benefit, create a pay run) — no new business logic, just a
-- row recording that something happened and who should see it.
--
-- recipient_user_id is a user, not an employee — the recipients of most
-- events (admin/hr_manager/payroll_manager approving a request, or a
-- manager approving their report's leave) may not have an employees row of
-- their own, so keying off org_memberships.user_id is the only recipient
-- identity guaranteed to exist for everyone who needs to receive one.
--
-- No SECURITY DEFINER helper needed: unlike Manager Self-Service, nothing
-- here is self-referential (this policy doesn't query notifications to
-- decide who can insert into notifications), so a plain RLS check is
-- enough — any org member may create a notification for another member of
-- the same org (the actual business authorization for *why* a notification
-- fires already lives in the action that calls this insert; this policy
-- only stops a notification from being planted in an org you don't
-- belong to, or addressed to someone outside that org).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'loan_request_submitted', 'loan_approved', 'loan_rejected',
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'benefit_enrolled',
    'pay_run_created'
  )),
  message text not null check (char_length(message) > 0),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_user_id_idx on public.notifications (recipient_user_id, read_at);
create index notifications_org_id_idx on public.notifications (org_id);

alter table public.notifications enable row level security;

create policy "users can view their own notifications"
on public.notifications for select
to authenticated
using (recipient_user_id = auth.uid());

create policy "org members can create notifications for other org members"
on public.notifications for insert
to authenticated
with check (
  core.is_org_member(org_id)
  and exists (
    select 1 from public.org_memberships m
    where m.user_id = notifications.recipient_user_id and m.org_id = notifications.org_id
  )
);

create policy "users can mark their own notifications read"
on public.notifications for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
