-- Attendance today is entirely admin/HR-entered: a manager or HR user
-- clicks cells on a weekly grid, and "present" is never stored, only
-- implied by the absence of a row. There is no first-party way for the
-- attendance data to originate from the employee who was actually there —
-- reported as "there should be a menu for them to clock in for attendance
-- daily".
--
-- Adds a narrow, self-service "clock in today" path: an employee may
-- insert exactly one row for themselves, for today, with status
-- 'present' — never late/absent (those stay an HR/admin judgement call,
-- same as today), never a past or future date (today only, so this can't
-- be used to backfill or pre-fill attendance), and never overwriting an
-- existing row (the unique (employee_id, date) constraint already
-- enforced this; an admin/HR correction made before or after the employee
-- clocks in always wins, since only they hold UPDATE rights on this
-- table). Storing 'present' is new — previously that status was never
-- written, only implied — so the check constraint widens to admit it.
alter table public.attendance_records
  drop constraint if exists attendance_records_status_check;

alter table public.attendance_records
  add constraint attendance_records_status_check check (status in ('present', 'late', 'absent'));

create policy "employees can clock in their own attendance"
on public.attendance_records for insert
to authenticated
with check (
  status = 'present'
  and date = (now() at time zone 'Africa/Lagos')::date
  and marked_by = auth.uid()
  and exists (
    select 1 from public.employees e
    where e.id = attendance_records.employee_id and e.user_id = auth.uid()
  )
);
