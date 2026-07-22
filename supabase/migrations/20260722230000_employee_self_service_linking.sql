-- Links a payroll record (public.employees) to a real login identity
-- (auth.users), so an employee can eventually see their own data. Nullable
-- throughout: most employees won't have a platform account, especially
-- during early rollout, and that must never block payroll operations.
alter table public.employees
  add column email text,
  add column user_id uuid references auth.users (id) on delete set null,
  add column linked_at timestamptz;

-- Partial unique indexes (not plain unique columns) because both email and
-- user_id are nullable and multiple employees may legitimately have neither
-- set yet.
create unique index employees_org_id_email_key on public.employees (org_id, email) where email is not null;
create unique index employees_user_id_key on public.employees (user_id) where user_id is not null;

-- Employees can see their own payroll record — nothing else changes;
-- admins/HR already had broader visibility via the existing policy.
create policy "employees can view their own employee record"
on public.employees for select
to authenticated
using (user_id = auth.uid());

-- Employees can see their own payslips, never anyone else's. This is the
-- actual self-service payoff: "latest payslip breakdown" from
-- product-and-ia.md's Employee role description.
create policy "employees can view their own payslips"
on public.payslips for select
to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = payslips.employee_id
      and e.user_id = auth.uid()
  )
);

-- HR Manager's documented scope is "Employees & onboarding" — onboarding
-- an employee into self-service means granting them the 'employee' role,
-- so HR needs to be able to insert that one role. Everything else
-- (admin/payroll_manager/hr_manager memberships) stays admin-only; this
-- is a narrow, principled widening, not a blanket loosening of who can
-- grant org access.
drop policy if exists "org admins can add memberships" on public.org_memberships;

create policy "admins can add any membership; HR can add employee-role memberships"
on public.org_memberships for insert
to authenticated
with check (
  core.has_org_role(org_id, array['admin'])
  or (role = 'employee' and core.has_org_role(org_id, array['admin', 'hr_manager']))
);

-- Atomically links an employee record to an auth.users id and grants the
-- 'employee' org_membership, so the rest of the app's role-based routing
-- treats them as a real member immediately. security invoker: the caller
-- must already satisfy employees' UPDATE policy (admin/HR) and the
-- org_memberships INSERT policy above — this function grants no privilege
-- beyond what the caller already has; it only makes both writes atomic.
--
-- Deliberately does NOT call auth.admin.inviteUserByEmail() or anything
-- else requiring the service-role key — that stays entirely in the
-- Next.js server action, on a client this function never touches. This
-- function only persists a linkage the caller has already established.
create or replace function public.link_employee_account(p_employee_id uuid, p_user_id uuid)
returns public.employees
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee public.employees;
begin
  update public.employees
  set user_id = p_user_id, linked_at = now()
  where id = p_employee_id
  returning * into v_employee;

  if v_employee.id is null then
    raise exception 'Employee % not found, or you do not have permission to link it', p_employee_id;
  end if;

  insert into public.org_memberships (org_id, user_id, role)
  values (v_employee.org_id, p_user_id, 'employee')
  on conflict (org_id, user_id) do nothing;

  return v_employee;
end;
$$;

revoke all on function public.link_employee_account(uuid, uuid) from public;
grant execute on function public.link_employee_account(uuid, uuid) to authenticated;
