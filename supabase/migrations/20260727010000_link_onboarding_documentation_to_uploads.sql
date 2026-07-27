-- "Documentation collected" on the onboarding checklist and the Documents
-- panel above it were two unlinked sections — an admin could tick the
-- checkbox as a bare attestation with zero files actually uploaded. This
-- makes the checkbox mean what it says: it can only be set true when at
-- least one row exists in employee_documents for that employee, and it
-- resets itself back to false if every document is later deleted (the
-- same "reset when the underlying condition changes" pattern as
-- core.reset_lifecycle_notified_flags for contract/probation alerts).
-- The Server Action gives the friendly error; this trigger is the
-- defense-in-depth backstop for any other write path.
create or replace function core.check_documentation_collected()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.documentation_collected and not exists (
    select 1 from public.employee_documents where employee_id = new.employee_id
  ) then
    raise exception 'documentation_collected requires at least one uploaded document for this employee';
  end if;
  return new;
end;
$$;

create trigger check_documentation_collected_trigger
before insert or update on public.employee_onboarding_checklist
for each row
execute function core.check_documentation_collected();

create or replace function core.reset_documentation_collected_on_document_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.employee_documents where employee_id = old.employee_id) then
    update public.employee_onboarding_checklist
    set documentation_collected = false
    where employee_id = old.employee_id and documentation_collected = true;
  end if;
  return old;
end;
$$;

create trigger reset_documentation_collected_on_document_delete_trigger
after delete on public.employee_documents
for each row
execute function core.reset_documentation_collected_on_document_delete();
