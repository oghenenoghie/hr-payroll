import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getProbationStatus, getContractStatus } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { notifyLifecycleDeadlines } from "@/lib/lifecycle-alerts";
import { getCachedDepartments, getCachedBranches } from "@/lib/reference-data";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Button } from "@/components/Button";
import { EmployeesTable } from "./EmployeesTable";

const PAGE_SIZE = 50;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; department?: string; branch?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  if (membership) {
    await notifyLifecycleDeadlines(supabase, membership.orgId);
  }

  const { q, status, department, branch, page: pageParam } = await searchParams;
  const searchTerm = q?.trim() ?? "";
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const [departments, branches] = await Promise.all([
    membership ? getCachedDepartments(membership.orgId) : Promise.resolve([]),
    membership ? getCachedBranches(membership.orgId) : Promise.resolve([]),
  ]);

  // Queries the salary-masked view rather than the raw table — for an
  // hr_manager viewer, any employee flagged salary_masked comes back with
  // null salary/bank columns (see the migration comment for why); admin
  // and payroll_manager always see real values through the same view.
  let query = supabase
    .from("employees_masked")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (searchTerm) {
    query = query.ilike("full_name", `%${searchTerm}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (department) {
    query = query.eq("department_id", department);
  }
  if (branch) {
    query = query.eq("branch_id", branch);
  }

  const { data: employees, count } = await query.range(
    (requestedPage - 1) * PAGE_SIZE,
    requestedPage * PAGE_SIZE - 1,
  );

  const totalEmployees = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const hasActiveFilters = Boolean(searchTerm || status || department || branch);

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (status) params.set("status", status);
    if (department) params.set("department", department);
    if (branch) params.set("branch", branch);
    params.set("page", String(page));
    return `/employees?${params.toString()}`;
  }

  // Mirrors exactly what the table below shows — "Restricted" wherever
  // employees_masked already nulled a salary-masked employee's figures,
  // never the real value, so the export can't leak more than the screen.
  // Scoped to this page, same as pagination elsewhere in this pass.
  const csv = toCsv(
    ["Name", "Department", "Branch", "State", "Basic (NGN)", "TIN", "Bank Details", "Status", "Probation", "Contract"],
    (employees ?? []).map((employee) => [
      employee.full_name ?? "",
      employee.department_name ?? "",
      employee.branch_name ?? "",
      employee.state_of_residence ?? "",
      employee.basic_kobo !== null ? toNaira(BigInt(employee.basic_kobo)).toFixed(2) : "Restricted",
      employee.tin ? "Valid" : "Missing",
      employee.salary_masked && employee.bank_account_number === null
        ? "Restricted"
        : employee.bank_account_number
          ? "On file"
          : "Missing",
      employee.status ?? "",
      getProbationStatus(employee.probation_end_date, employee.confirmed ?? false),
      getContractStatus(employee.employment_type ?? "permanent", employee.contract_end_date),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
          <h1 className="text-[22px] font-extrabold text-ink">Directory</h1>
          <p className="text-[13px] text-ink-soft">Directory, TIN status and self-service</p>
        </div>
        <div className="flex items-center gap-2">
          {employees && employees.length > 0 && (
            <ExportCsvButton csv={csv} filename="employees.csv" label="Export this page (CSV)" />
          )}
          <Button href="/employees/new">+ Add employee</Button>
        </div>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4" action="/employees">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="q">
            Search by name
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchTerm}
            placeholder="e.g. Amaka"
            className="w-[220px] rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="department">
            Department
          </label>
          <select
            id="department"
            name="department"
            defaultValue={department ?? ""}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="">All</option>
            {(departments ?? []).map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="branch">
            Branch
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={branch ?? ""}
            className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="">All</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" size="md">
          Filter
        </Button>
        {hasActiveFilters && (
          <Link href="/employees" className="px-2 py-[9px] text-[12.5px] font-bold text-primary">
            Clear filters
          </Link>
        )}
      </form>

      <EmployeesTable
        employees={employees ?? []}
        emptyMessage={hasActiveFilters ? "No employees match these filters." : "No employees yet."}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-soft">
            Page {currentPage} of {totalPages} · {totalEmployees} employee{totalEmployees === 1 ? "" : "s"}
            {hasActiveFilters ? " matching these filters" : ""}
          </span>
          <div className="flex gap-3">
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                ← Previous
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
            )}
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                Next →
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
