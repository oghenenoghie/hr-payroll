-- In-house e-signature for the Contract of Employment — the one
-- generated document with a genuine two-party "sign here" structure
-- (Offer/Confirmation Letter and the Employment & Salary Certificate are
-- both company-issued informational documents with no employee
-- counter-signature expectation, so neither needs this). Closes the
-- Document Generation feature-map gap disclosed as "E-signature is not
-- built" with the "custom consent/audit-trail system" option that
-- description named, not a third-party provider integration.
--
-- Append-only, kept-record shape (no update/delete policy for anyone),
-- same convention as employee_relations_case_notes/training_quiz_attempts/
-- asset_transfers. A row is never edited or superseded in place — instead,
-- document_hash pins each signature to the exact contract content (job
-- grade, department, employment type, dates, leave balance, and pay
-- components) at the moment it was signed, computed identically by the
-- signing action and by the page that displays whether a signature is
-- still current. If HR later edits any of those fields, the stored hash
-- no longer matches what's rendered today, so the old signature is kept
-- (it's still true that this employee signed THIS version, on THIS date)
-- but the page stops treating it as covering the current document and
-- prompts for a fresh signature — the same "an edit invalidates trust
-- in what's on file" property a real e-signature system provides,
-- without needing a second table or a mutable "superseded" flag.
create table public.employment_contract_signatures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  party text not null check (party in ('employer', 'employee')),
  signed_by uuid not null references auth.users (id),
  document_hash text not null,
  ip_address text,
  signed_at timestamptz not null default now()
);

create index employment_contract_signatures_employee_id_idx on public.employment_contract_signatures (employee_id);
create index employment_contract_signatures_org_id_idx on public.employment_contract_signatures (org_id);

alter table public.employment_contract_signatures enable row level security;

-- Read access mirrors exactly who can already reach the admin-facing
-- contract page today (employees/[id]/contract only gates on role !=
-- 'employee', not a specific role list) — any narrower policy here would
-- make the page look "unsigned" to a viewer who can already see the
-- whole contract's content, which is a more confusing failure mode than
-- just matching the page's own access. Plus the employee's own
-- signatures on their own contract.
create policy "non-employee roles can view contract signatures"
on public.employment_contract_signatures for select
to authenticated
using (
  exists (
    select 1 from public.org_memberships m
    where m.org_id = employment_contract_signatures.org_id
      and m.user_id = auth.uid()
      and m.role != 'employee'
  )
);

create policy "employees can view their own contract signatures"
on public.employment_contract_signatures for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = employment_contract_signatures.employee_id and e.user_id = auth.uid()
  )
);

-- No insert policy at all — every write goes through
-- sign_employment_contract below, which enforces exactly who may sign
-- which party (an employee only their own, an admin/hr_manager only as
-- the employer) rather than a general insert grant a client could bypass
-- to sign for someone else.

-- security definer with an explicit, narrow authorization check inside —
-- same shape as acknowledge_performance_appraisal and
-- review_leave_encashment_request: the actor can do exactly this one
-- constrained thing (sign their own contract, or sign as the employer if
-- they hold the role for it), never a general write.
create or replace function public.sign_employment_contract(
  p_employee_id uuid,
  p_party text,
  p_document_hash text,
  p_ip_address text default null
)
returns public.employment_contract_signatures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees;
  v_signature public.employment_contract_signatures;
begin
  if p_party not in ('employer', 'employee') then
    raise exception 'Invalid signing party: %', p_party;
  end if;

  if p_document_hash is null or char_length(p_document_hash) = 0 then
    raise exception 'A document hash is required to sign';
  end if;

  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then
    raise exception 'Employee % not found', p_employee_id;
  end if;

  if p_party = 'employee' then
    if v_employee.user_id is distinct from auth.uid() then
      raise exception 'You can only sign your own contract';
    end if;
  else
    if not core.has_org_role(v_employee.org_id, array['admin', 'hr_manager']) then
      raise exception 'You do not have permission to sign as the employer';
    end if;
  end if;

  insert into public.employment_contract_signatures (org_id, employee_id, party, signed_by, document_hash, ip_address)
  values (v_employee.org_id, p_employee_id, p_party, auth.uid(), p_document_hash, p_ip_address)
  returning * into v_signature;

  return v_signature;
end;
$$;

revoke all on function public.sign_employment_contract(uuid, text, text, text) from public;
grant execute on function public.sign_employment_contract(uuid, text, text, text) to authenticated;
