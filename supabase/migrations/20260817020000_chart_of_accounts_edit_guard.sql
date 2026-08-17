-- Chart of Accounts was create/delete only — no edit path existed at all
-- (see 20260730020000_chart_of_accounts.sql's own comment: "the UI hides
-- delete (not edit) for these" — edit was simply never built, for any
-- account). This closes that gap: name/description/type become editable
-- for every account (a mislabeled account is exactly the kind of mistake
-- this should let a payroll admin fix), but an account's code stays
-- locked once it's a system account, enforced here at the database layer
-- rather than only hidden in the UI — same "in the policy itself" stance
-- the delete restriction already takes. Custom (non-system) accounts can
-- still have their code changed; nothing posts to those by convention
-- the way it does to the seeded set in apps/wagebook/src/lib/accounts.ts.
create or replace function core.prevent_system_account_code_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system and new.code <> old.code then
    raise exception 'The code of a system account cannot be changed (% is relied on by existing postings)', old.code;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_system_account_code_change on public.chart_of_accounts;
create trigger prevent_system_account_code_change
before update on public.chart_of_accounts
for each row
execute function core.prevent_system_account_code_change();
