-- Quizzes and real completion verification for Learning Management,
-- replacing pure self-report for any course an admin/hr_manager chooses
-- to build one for. Multiple-choice only (up to 4 options, exactly one
-- correct), unlimited retakes, no per-question feedback after grading —
-- deliberately, so that repeated attempts can't be used to reconstruct
-- the answer key one question at a time. Every attempt is graded and
-- recorded server-side; the client never receives which option is
-- correct, at any point, for any role except admin/hr_manager authoring
-- the quiz.
--
-- has_quiz is a denormalized, trigger-maintained flag on training_courses
-- (mirrors the "documentation collected" auto-unticking trigger from
-- Employee Management) so the main /learning page — which an ordinary
-- employee reads under their own RLS — can tell whether a course has a
-- quiz without ever touching training_course_quiz_questions/options
-- directly, since those two tables are intentionally admin/hr_manager-
-- only at the RLS layer: an employee gets zero rows querying them
-- directly, no matter which columns are asked for. The only way for an
-- employee to see question/option TEXT (never is_correct) is the
-- security-definer get_training_quiz_questions() function below, and the
-- only way to record a graded attempt is submit_training_quiz_attempt().
alter table public.training_courses
  add column if not exists quiz_passing_percent integer not null default 70 check (quiz_passing_percent between 1 and 100),
  add column if not exists has_quiz boolean not null default false;

create table public.training_course_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  question_text text not null check (char_length(question_text) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index training_course_quiz_questions_org_id_idx on public.training_course_quiz_questions (org_id);
create index training_course_quiz_questions_course_id_idx on public.training_course_quiz_questions (course_id);

alter table public.training_course_quiz_questions enable row level security;

create policy "admins and hr managers can view quiz questions"
on public.training_course_quiz_questions for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can add quiz questions"
on public.training_course_quiz_questions for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update quiz questions"
on public.training_course_quiz_questions for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete quiz questions"
on public.training_course_quiz_questions for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create table public.training_course_quiz_options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  question_id uuid not null references public.training_course_quiz_questions (id) on delete cascade,
  option_text text not null check (char_length(option_text) > 0),
  is_correct boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index training_course_quiz_options_org_id_idx on public.training_course_quiz_options (org_id);
create index training_course_quiz_options_question_id_idx on public.training_course_quiz_options (question_id);

alter table public.training_course_quiz_options enable row level security;

create policy "admins and hr managers can view quiz options"
on public.training_course_quiz_options for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can add quiz options"
on public.training_course_quiz_options for insert
to authenticated
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can update quiz options"
on public.training_course_quiz_options for update
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']))
with check (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "admins and hr managers can delete quiz options"
on public.training_course_quiz_options for delete
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

-- Kept as a permanent record — no update/delete policy for anyone, same
-- "once logged, it's part of the record" convention as
-- employee_relations_case_notes/journal_entries. No insert policy either:
-- the only writer is submit_training_quiz_attempt() below, so a graded
-- attempt can never be hand-entered by any role, including admin.
create table public.training_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  enrollment_id uuid not null references public.training_enrollments (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  score_percent integer not null check (score_percent between 0 and 100),
  passed boolean not null,
  submitted_at timestamptz not null default now()
);

create index training_quiz_attempts_org_id_idx on public.training_quiz_attempts (org_id);
create index training_quiz_attempts_enrollment_id_idx on public.training_quiz_attempts (enrollment_id);
create index training_quiz_attempts_employee_id_idx on public.training_quiz_attempts (employee_id);

alter table public.training_quiz_attempts enable row level security;

create policy "employees can view their own quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = training_quiz_attempts.employee_id and e.user_id = auth.uid()
  )
);

create policy "admins and hr managers can view all quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (core.has_org_role(org_id, array['admin', 'hr_manager']));

create policy "department managers can view their department's quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (core.is_department_manager_of(training_quiz_attempts.employee_id));

create policy "auditors can view quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (core.has_org_role(org_id, array['auditor']));

create policy "chro can view quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (core.has_org_role(org_id, array['chro']));

create policy "legal and compliance can view quiz attempts"
on public.training_quiz_attempts for select
to authenticated
using (core.has_org_role(org_id, array['legal_compliance']));

-- Keeps training_courses.has_quiz in sync whenever questions are added to
-- or removed from a course — the same auto-maintained-flag shape as the
-- "documentation collected" onboarding checklist item, which un-ticks
-- itself when every document is deleted.
create or replace function public.sync_training_course_has_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  v_course_id := coalesce(new.course_id, old.course_id);
  update public.training_courses
  set has_quiz = exists (select 1 from public.training_course_quiz_questions where course_id = v_course_id)
  where id = v_course_id;
  return null;
end;
$$;

create trigger training_course_quiz_questions_sync_has_quiz
after insert or delete on public.training_course_quiz_questions
for each row execute function public.sync_training_course_has_quiz();

-- Returns question/option text only — is_correct is never in the return
-- type, so there is no way to leak it through this function regardless of
-- caller. Access matches the course catalog's own visibility (any org
-- member), not enrollment-specific, the same breadth training_courses
-- itself already grants.
create or replace function public.get_training_quiz_questions(p_course_id uuid)
returns table (
  question_id uuid,
  question_text text,
  question_sort_order int,
  option_id uuid,
  option_text text,
  option_sort_order int
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.training_courses where id = p_course_id;
  if v_org_id is null then
    raise exception 'Course % not found', p_course_id;
  end if;

  if not core.is_org_member(v_org_id) then
    raise exception 'You do not have permission to view this quiz';
  end if;

  return query
  select q.id, q.question_text, q.sort_order, o.id, o.option_text, o.sort_order
  from public.training_course_quiz_questions q
  join public.training_course_quiz_options o on o.question_id = q.id
  where q.course_id = p_course_id
  order by q.sort_order, q.created_at, o.sort_order, o.created_at;
end;
$$;

revoke all on function public.get_training_quiz_questions(uuid) from public, anon;
grant execute on function public.get_training_quiz_questions(uuid) to authenticated;

-- Grades server-side, never trusting a client-submitted score. Requires
-- exactly one answer per question (rejects missing, duplicate, or
-- extra-question answers outright) so "submit every option for every
-- question" can't trivially force a 100%. Only the enrolled employee
-- themself may submit — not admin/hr_manager on their behalf, since the
-- entire point is verifying that specific person engaged with the
-- material. Passing flips the enrollment to completed in the same
-- transaction; a failed attempt is still recorded but leaves the
-- enrollment assigned for another try.
create or replace function public.submit_training_quiz_attempt(p_enrollment_id uuid, p_answers jsonb)
returns table (score_percent int, passed boolean, submitted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.training_enrollments;
  v_course public.training_courses;
  v_total int;
  v_answered int;
  v_distinct int;
  v_correct int;
  v_score int;
  v_passed boolean;
  v_now timestamptz := now();
begin
  select * into v_enrollment from public.training_enrollments where id = p_enrollment_id;

  if v_enrollment.id is null then
    raise exception 'Enrollment % not found', p_enrollment_id;
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = v_enrollment.employee_id and e.user_id = auth.uid()
  ) then
    raise exception 'You do not have permission to take this quiz';
  end if;

  if v_enrollment.status = 'completed' then
    raise exception 'This training is already completed';
  end if;

  select * into v_course from public.training_courses where id = v_enrollment.course_id;

  select count(*) into v_total
  from public.training_course_quiz_questions
  where course_id = v_course.id;

  if v_total = 0 then
    raise exception 'This course has no quiz';
  end if;

  select count(*), count(distinct (elem->>'question_id'))
    into v_answered, v_distinct
  from jsonb_array_elements(p_answers) as elem;

  if v_answered != v_total or v_distinct != v_total then
    raise exception 'Answer every question exactly once';
  end if;

  select count(*) into v_correct
  from jsonb_array_elements(p_answers) as elem
  join public.training_course_quiz_questions q
    on q.id = (elem->>'question_id')::uuid and q.course_id = v_course.id
  join public.training_course_quiz_options o
    on o.id = (elem->>'option_id')::uuid and o.question_id = q.id
  where o.is_correct;

  v_score := round((v_correct::numeric / v_total) * 100);
  v_passed := v_score >= v_course.quiz_passing_percent;

  insert into public.training_quiz_attempts (org_id, enrollment_id, employee_id, course_id, score_percent, passed, submitted_at)
  values (v_enrollment.org_id, v_enrollment.id, v_enrollment.employee_id, v_course.id, v_score, v_passed, v_now);

  if v_passed then
    update public.training_enrollments
    set status = 'completed', completed_at = v_now
    where id = p_enrollment_id;
  end if;

  return query select v_score, v_passed, v_now;
end;
$$;

revoke all on function public.submit_training_quiz_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_training_quiz_attempt(uuid, jsonb) to authenticated;

-- Republished with one added guard: a course with a quiz can no longer be
-- self-reported complete — that path stays for courses with no quiz at
-- all, and submit_training_quiz_attempt() becomes the only completion
-- route once a quiz exists.
create or replace function public.mark_training_enrollment_complete(p_enrollment_id uuid)
returns public.training_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.training_enrollments;
  v_is_self boolean;
  v_has_quiz boolean;
begin
  select * into v_enrollment from public.training_enrollments where id = p_enrollment_id;

  if v_enrollment.id is null then
    raise exception 'Enrollment % not found', p_enrollment_id;
  end if;

  select exists (
    select 1 from public.employees e
    where e.id = v_enrollment.employee_id and e.user_id = auth.uid()
  ) into v_is_self;

  if not (v_is_self or core.has_org_role(v_enrollment.org_id, array['admin', 'hr_manager'])) then
    raise exception 'You do not have permission to complete this enrollment';
  end if;

  if v_enrollment.status = 'completed' then
    raise exception 'Enrollment % is already completed', p_enrollment_id;
  end if;

  select has_quiz into v_has_quiz from public.training_courses where id = v_enrollment.course_id;

  if v_has_quiz then
    raise exception 'This course has a quiz — complete it to mark this training done';
  end if;

  update public.training_enrollments
  set status = 'completed', completed_at = now()
  where id = p_enrollment_id
  returning * into v_enrollment;

  return v_enrollment;
end;
$$;

revoke all on function public.mark_training_enrollment_complete(uuid) from public, anon;
grant execute on function public.mark_training_enrollment_complete(uuid) to authenticated;
