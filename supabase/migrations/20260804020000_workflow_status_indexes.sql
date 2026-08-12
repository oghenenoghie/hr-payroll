-- Composite (org_id, status) indexes for the workflow-queue tables whose
-- list pages now filter pending/settled server-side instead of fetching
-- everything and filtering in JS (leave, loans, expenses, overtime,
-- leave encashment), plus a few gaps found in the same performance-audit
-- pass on tables that were never given a status/stage index at all
-- (job_requisitions, candidates) or a composite matching how the
-- dashboard widgets and Invoice Aging report actually filter
-- (candidate_interviews, customer_invoices, performance_goals,
-- performance_appraisals). Pure index additions — no table, policy or
-- function changes — so this is safe to apply to a live database with
-- existing data, matching every index-only migration this session.
create index if not exists leave_requests_org_id_status_idx on public.leave_requests (org_id, status);
create index if not exists leave_encashment_requests_org_id_status_idx on public.leave_encashment_requests (org_id, status);
create index if not exists loans_org_id_status_idx on public.loans (org_id, status);
create index if not exists expenses_org_id_status_idx on public.expenses (org_id, status);
create index if not exists overtime_requests_org_id_status_idx on public.overtime_requests (org_id, status);

create index if not exists job_requisitions_org_id_status_idx on public.job_requisitions (org_id, status);
create index if not exists candidates_org_id_stage_idx on public.candidates (org_id, stage);
create index if not exists candidate_interviews_interviewer_outcome_idx on public.candidate_interviews (interviewer_id, outcome, scheduled_at);

create index if not exists customer_invoices_status_due_date_idx on public.customer_invoices (status, due_date);

create index if not exists performance_goals_org_id_status_idx on public.performance_goals (org_id, status);
create index if not exists performance_appraisals_org_id_status_idx on public.performance_appraisals (org_id, status);
