-- Widens notifications_type_check to accept the two new NotificationType
-- values added for lifecycle deadline alerts (contract_expiring,
-- probation_ending — see 20260724070000_lifecycle_alerts.sql and
-- lib/notifications.ts). The check constraint enforces the same enum the
-- TypeScript union expresses at the application layer; the two must be
-- widened together or every insert of a new type fails at the database
-- with a check-constraint violation, caught live while verifying this
-- phase rather than in production.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'loan_request_submitted', 'loan_approved', 'loan_rejected',
    'expense_submitted', 'expense_approved', 'expense_rejected',
    'benefit_enrolled', 'pay_run_created',
    'overtime_request_submitted', 'overtime_approved', 'overtime_rejected',
    'leave_encashment_submitted', 'leave_encashment_approved', 'leave_encashment_rejected',
    'policy_published', 'contract_expiring', 'probation_ending'
  ]));
