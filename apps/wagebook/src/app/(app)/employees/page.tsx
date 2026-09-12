import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import type { Tables } from "@plutus/core";
import { createClient } from "@/lib/supabase/server";
import { formatKobo, getProbationStatus, getContractStatus, getEmployeeLifecycleStage, type EmployeeLifecycleStage } from "@/lib/format";
import {
  TinBadge,
  EmployeeStatusBadge,
  BankDetailsBadge,
  ProbationBadge,
  ContractStatusBadge,
  EmployeeLifecycleStageBadge,
} from "@/components/Badge";
import { getMembership } from "@/lib/membership";
import { notifyLifecycleDeadlines } from "@/lib/lifecycle-alerts";
import { getCachedDepartments, getCachedBranches } from "@/lib/reference-data";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

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

  // Onboarding/offboarding checklist rows are created lazily (upsert on
  // first edit, see edit/actions.ts) — most employees, especially anyone
  // who joined before either checklist existed, have no row at all. A
  // missing row defaults to "done" (true), never "still onboarding" or
  // "still offboarding" forever, since absence of tracking data isn't
  // evidence the step didn't happen — see getEmployeeLifecycleStage.
  const employeeIds = (employees ?? []).map((employee) => employee.id).filter((id): id is string => Boolean(id));
  const [{ data: onboardingRows }, { data: offboardingRows }] = await Promise.all([
    employeeIds.length > 0
      ? supabase
          .from("employee_onboarding_checklist")
          .select("employee_id, documentation_collected, contract_signed")
          .in("employee_id", employeeIds)
      : Promise.resolve({ data: [] }),
    employeeIds.length > 0
      ? supabase
          .from("employee_offboarding_checklist")
          .select("employee_id, notice_period_served, assets_returned, clearance_obtained, experience_letter_issued")
          .in("employee_id", employeeIds)
      : Promise.resolve({ data: [] }),
  ]);
  const onboardingByEmployeeId = new Map((onboardingRows ?? []).map((row) => [row.employee_id, row]));
  const offboardingByEmployeeId = new Map((offboardingRows ?? []).map((row) => [row.employee_id, row]));

  const lifecycleStageByEmployeeId = new Map<string, EmployeeLifecycleStage>(
    (employees ?? [])
      .filter((employee): employee is typeof employee & { id: string } => Boolean(employee.id))
      .map((employee) => {
        const onboarding = onboardingByEmployeeId.get(employee.id);
        const offboarding = offboardingByEmployeeId.get(employee.id);
        return [
          employee.id,
          getEmployeeLifecycleStage({
            status: employee.status ?? "active",
            confirmed: employee.confirmed ?? false,
            probationEndDate: employee.probation_end_date,
            onboardingDocumentationCollected: onboarding?.documentation_collected ?? true,
            onboardingContractSigned: onboarding?.contract_signed ?? true,
            offboardingNoticePeriodServed: offboarding?.notice_period_served ?? true,
            offboardingAssetsReturned: offboarding?.assets_returned ?? true,
            offboardingClearanceObtained: offboarding?.clearance_obtained ?? true,
            offboardingExperienceLetterIssued: offboarding?.experience_letter_issued ?? true,
          }),
        ];
      }),
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
    ["Name", "Department", "Branch", "State", "Basic (NGN)", "TIN", "Bank Details", "Status", "Probation", "Contract", "Lifecycle Stage"],
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
      employee.id ? (lifecycleStageByEmployeeId.get(employee.id) ?? "active") : "active",
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
          <Link
            href="/employees/new"
            className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            + Add employee
          </Link>
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
        <button
          type="submit"
          className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
        >
          Filter
        </button>
        {hasActiveFilters && (
          <Link href="/employees" className="px-2 py-[9px] text-[12.5px] font-bold text-primary">
            Clear filters
          </Link>
        )}
      </form>

      <EmployeesTable
        employees={employees ?? []}
        lifecycleStageByEmployeeId={lifecycleStageByEmployeeId}
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

function EmployeesTable({
  employees,
  lifecycleStageByEmployeeId,
  emptyMessage,
}: {
  employees: Tables<"employees_masked">[];
  lifecycleStageByEmployeeId: Map<string, EmployeeLifecycleStage>;
  emptyMessage: string;
}) {
  const columns: DataTableColumn<Tables<"employees_masked">>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (employee) => employee.full_name ?? "",
      render: (employee) => <span className="font-bold text-ink">{employee.full_name}</span>,
    },
    {
      key: "department",
      header: "Department",
      sortValue: (employee) => employee.department_name ?? "",
      render: (employee) => <span className="text-ink-soft">{employee.department_name ?? "—"}</span>,
    },
    {
      key: "branch",
      header: "Branch",
      sortValue: (employee) => employee.branch_name ?? "",
      render: (employee) => <span className="text-ink-soft">{employee.branch_name ?? "—"}</span>,
    },
    {
      key: "state",
      header: "State",
      sortValue: (employee) => employee.state_of_residence ?? "",
      render: (employee) => <span className="text-ink-soft">{employee.state_of_residence ?? "—"}</span>,
    },
    {
      key: "basic",
      header: "Basic",
      align: "right",
      render: (employee) =>
        employee.basic_kobo !== null ? (
          <span className="font-bold text-ink">{formatKobo(BigInt(employee.basic_kobo))}</span>
        ) : (
          <span className="text-ink-soft">Restricted</span>
        ),
    },
    {
      key: "tin",
      header: "TIN",
      align: "center",
      render: (employee) => <TinBadge tin={employee.tin} />,
    },
    {
      key: "bank",
      header: "Bank details",
      align: "center",
      render: (employee) =>
        employee.salary_masked && employee.bank_account_number === null ? (
          <span className="text-ink-soft">Restricted</span>
        ) : (
          <BankDetailsBadge bankAccountNumber={employee.bank_account_number} />
        ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (employee) => <EmployeeStatusBadge status={employee.status ?? "active"} />,
    },
    {
      key: "lifecycle_stage",
      header: "Lifecycle Stage",
      align: "center",
      render: (employee) => (
        <EmployeeLifecycleStageBadge stage={employee.id ? (lifecycleStageByEmployeeId.get(employee.id) ?? "active") : "active"} />
      ),
    },
    {
      key: "probation",
      header: "Probation",
      align: "center",
      render: (employee) => (
        <ProbationBadge status={getProbationStatus(employee.probation_end_date, employee.confirmed ?? false)} />
      ),
    },
    {
      key: "contract",
      header: "Contract",
      align: "center",
      render: (employee) => (
        <ContractStatusBadge
          status={getContractStatus(employee.employment_type ?? "permanent", employee.contract_end_date)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (employee) => (
        <div className="flex justify-end gap-3">
          <Link href={`/employees/${employee.id}`} className="font-bold text-primary">
            View
          </Link>
          <Link href={`/employees/${employee.id}/edit`} className="font-bold text-primary">
            Edit
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={employees}
      rowKey={(employee) => employee.id!}
      emptyMessage={emptyMessage}
    />
  );
}
