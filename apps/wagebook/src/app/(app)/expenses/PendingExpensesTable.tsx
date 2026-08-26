"use client";

import { formatKobo, getPendingAgeTone } from "@/lib/format";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { approveExpense, rejectExpense } from "./actions";

type PendingExpense = {
  id: string;
  amount_kobo: number;
  description: string;
  taxable: boolean | null;
  status: string;
  created_at: string;
  employees: { full_name: string } | null;
};

// Split out from page.tsx (a Server Component) because DataTable's columns
// carry render/sortValue functions, which can't be serialized across the
// server/client boundary — see EmployeesTable.tsx for the same note.
export function PendingExpensesTable({ pending }: { pending: PendingExpense[] }) {
  const columns: DataTableColumn<PendingExpense>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (expense) => expense.employees?.full_name ?? "",
      render: (expense) => <span className="font-bold text-ink">{expense.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (expense) => expense.amount_kobo,
      render: (expense) => <span className="text-ink">{formatKobo(BigInt(expense.amount_kobo))}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (expense) => <span className="text-ink-soft">{expense.description}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (expense) => (
        <div className="flex justify-end gap-2">
          <ConfirmActionButton
            action={approveExpense.bind(null, expense.id, true)}
            label="Approve · taxable"
            variant="row"
            confirmTitle="Approve this claim as taxable?"
            confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be approved and added to chargeable income, re-taxed in the next pay run.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={approveExpense.bind(null, expense.id, false)}
            label="Approve · non-taxable"
            variant="row"
            confirmTitle="Approve this claim as non-taxable?"
            confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be approved and paid out as pure cash in the next pay run.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={rejectExpense.bind(null, expense.id)}
            label="Reject"
            confirmTitle="Reject this claim?"
            confirmMessage={`${expense.employees?.full_name ?? "This employee"}'s ${formatKobo(BigInt(expense.amount_kobo))} claim will be rejected.`}
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
      rowKey={(expense) => expense.id}
      rowClassName={(expense) => (getPendingAgeTone(expense.created_at) === "warn" ? "bg-warn-tint" : "")}
    />
  );
}
