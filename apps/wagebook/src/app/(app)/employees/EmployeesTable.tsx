"use client";

import Link from "next/link";
import type { Tables } from "@plutus/core";
import { formatKobo, getProbationStatus, getContractStatus } from "@/lib/format";
import {
  TinBadge,
  EmployeeStatusBadge,
  BankDetailsBadge,
  ProbationBadge,
  ContractStatusBadge,
} from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

// Split out from page.tsx (a Server Component) because DataTable's columns
// carry render/sortValue functions, which can't be serialized across the
// server/client boundary — passing them from a Server Component crashes
// with "Functions cannot be passed directly to Client Components". This
// file being "use client" means the columns array (and its functions)
// never crosses that boundary; it's built entirely on the client.
export function EmployeesTable({
  employees,
  emptyMessage,
}: {
  employees: Tables<"employees_masked">[];
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
