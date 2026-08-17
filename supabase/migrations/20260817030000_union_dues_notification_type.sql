-- Widens notifications_type_check to accept 'union_dues_enrolled' (added
-- to NotificationType in apps/wagebook/src/lib/notifications.ts), same
-- drop/add-constraint pattern every prior addition to this enum has used
-- since 20260724080000_notifications_lifecycle_types.sql — the check
-- constraint enforces the same enum the TypeScript type promises.
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
  'union_dues_enrolled',
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
