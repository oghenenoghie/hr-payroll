"use client";

import { formatKobo, getPendingAgeTone } from "@/lib/format";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { approveLoan, rejectLoan } from "./actions";

type PendingLoan = {
  id: string;
  principal_kobo: number;
  monthly_repayment_kobo: number;
  reason: string | null;
  status: string;
  created_at: string;
  employees: { full_name: string } | null;
};

// Split out from page.tsx (a Server Component) because DataTable's columns
// carry render/sortValue functions, which can't be serialized across the
// server/client boundary — see EmployeesTable.tsx for the same note.
export function PendingLoansTable({ pending }: { pending: PendingLoan[] }) {
  const columns: DataTableColumn<PendingLoan>[] = [
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
      key: "monthly_repayment",
      header: "Monthly repayment",
      align: "right",
      sortValue: (loan) => loan.monthly_repayment_kobo,
      render: (loan) => <span className="text-ink-soft">{formatKobo(BigInt(loan.monthly_repayment_kobo))}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      render: (loan) => <span className="text-ink-soft">{loan.reason ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (loan) => (
        <div className="flex justify-end gap-2">
          <ConfirmActionButton
            action={approveLoan.bind(null, loan.id)}
            label="Approve"
            variant="row"
            confirmTitle="Approve this loan?"
            confirmMessage={`${loan.employees?.full_name ?? "This employee"}'s loan of ${formatKobo(BigInt(loan.principal_kobo))} will be approved, with ${formatKobo(BigInt(loan.monthly_repayment_kobo))} deducted from net pay each run until fully repaid.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={rejectLoan.bind(null, loan.id)}
            label="Reject"
            confirmTitle="Reject this loan?"
            confirmMessage={`${loan.employees?.full_name ?? "This employee"}'s loan request will be rejected.`}
            confirmLabel="Reject"
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={pending}
      rowKey={(loan) => loan.id}
      rowClassName={(loan) => (getPendingAgeTone(loan.created_at) === "warn" ? "bg-warn-tint" : "")}
    />
  );
}
