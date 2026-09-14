"use client";

import { formatKobo } from "@/lib/format";
import { ExpenseStatusBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type SettledExpense = {
  id: string;
  amount_kobo: number;
  description: string;
  taxable: boolean | null;
  status: string;
  employees: { full_name: string } | null;
};

// Split out from page.tsx (a Server Component) — see EmployeesTable.tsx
// for why DataTable's columns can't be built there.
export function SettledExpensesTable({ expenses }: { expenses: SettledExpense[] }) {
  const columns: DataTableColumn<SettledExpense>[] = [
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
      key: "tax_treatment",
      header: "Tax treatment",
      align: "center",
      render: (expense) => (
        <span className="text-ink-soft">
          {expense.taxable === null ? "—" : expense.taxable ? "Taxable" : "Non-taxable"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (expense) => <ExpenseStatusBadge status={expense.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={expenses}
      rowKey={(expense) => expense.id}
      emptyMessage="No expense history yet."
    />
  );
}
