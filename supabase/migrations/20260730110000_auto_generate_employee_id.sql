-- Auto-generated Employee ID: employee_id (the badge/staff number,
-- distinct from the row's own id) was optional and free-text, requiring
-- an admin to type one in by hand. It now assigns itself automatically —
-- an 8-character code from Crockford's Base32 alphabet (0-9 and A-Z minus
-- I, L, O, U, which are easy to misread or confuse with 1/0), chosen
-- because this is also a login identifier employees read off a badge and
-- type in by hand (see 20260729020000_employee_id_login.sql) — 32^8 (~1.1
-- trillion) combinations keeps collisions vanishingly unlikely, and the
-- generator itself re-checks and retries regardless.
--
-- The New Employee form no longer exposes this field at all: every
-- employee gets one, nobody chooses it, so there is nothing left to
-- validate for uniqueness at the application layer — the existing unique
-- index (employees_employee_id_key) is the only guard needed, and the
-- generator's own retry loop keeps it from ever being hit in practice.
--
-- Idempotent (create or replace / drop trigger if exists), matching every
-- migration since 20260730010000: this project's operator applies
-- migrations by hand in the SQL Editor, so a half-applied or repeated run
-- must be safe to redo from the top.
create or replace function public.generate_employee_id()
returns text
language plpgsql
as $$
declare
  alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.employees where employee_id = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_employee_id_default()
returns trigger
language plpgsql
as $$
begin
  if new.employee_id is null then
    new.employee_id := public.generate_employee_id();
  end if;
  return new;
end;
$$;

drop trigger if exists employees_set_employee_id_trigger on public.employees;
create trigger employees_set_employee_id_trigger
before insert on public.employees
for each row
execute function public.set_employee_id_default();

-- Backfill: every existing employee missing one gets assigned the same
-- way, once, right now. Safe to re-run — only NULL rows are touched.
update public.employees
set employee_id = public.generate_employee_id()
where employee_id is null;
