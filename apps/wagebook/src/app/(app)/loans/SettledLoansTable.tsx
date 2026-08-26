"use client";

import { formatKobo } from "@/lib/format";
import { LoanStatusBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type SettledLoan = {
  id: string;
  principal_kobo: number;
  outstanding_kobo: number;
  monthly_repayment_kobo: number;
  reason: string | null;
  status: string;
  employees: { full_name: string } | null;
};

// Split out from page.tsx (a Server Component) — see EmployeesTable.tsx
// for why DataTable's columns can't be built there.
export function SettledLoansTable({ loans }: { loans: SettledLoan[] }) {
  const columns: DataTableColumn<SettledLoan>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (loan) => loan.employees?.full_name ?? "",
      render: (loan) => <span className="font-bold text-ink">{loan.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (loan) => loan.principal_kobo,
      render: (loan) => <span className="text-ink">{formatKobo(BigInt(loan.principal_kobo))}</span>,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      sortValue: (loan) => loan.outstanding_kobo,
      render: (loan) => <span className="text-ink-soft">{formatKobo(BigInt(loan.outstanding_kobo))}</span>,
    },
    {
      key: "monthly_repayment",
      header: "Monthly repayment",
      align: "right",
      sortValue: (loan) => loan.monthly_repayment_kobo,
      render: (loan) => <span className="text-ink-soft">{formatKobo(BigInt(loan.monthly_repayment_kobo))}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (loan) => <LoanStatusBadge status={loan.status} />,
    },
  ];

  return (
    <DataTable columns={columns} rows={loans} rowKey={(loan) => loan.id} emptyMessage="No loan history yet." />
  );
}
