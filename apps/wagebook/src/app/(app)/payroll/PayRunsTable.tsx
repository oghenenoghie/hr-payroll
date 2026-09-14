"use client";

import Link from "next/link";
import { formatKobo } from "@/lib/format";
import { FREQUENCY_LABEL } from "@/lib/accounts";
import { PayRunStatusBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type PayRunRow = {
  id: string;
  period_start: string;
  period_end: string;
  frequency: string;
  employee_count: number;
  gross_kobo: number;
  net_kobo: number;
  rule_version_id: string;
  status: string;
};

// Split out from page.tsx (a Server Component) because DataTable's columns
// carry render/sortValue functions, which can't be serialized across the
// server/client boundary — see EmployeesTable.tsx for the same note.
export function PayRunsTable({ payRuns }: { payRuns: PayRunRow[] }) {
  const columns: DataTableColumn<PayRunRow>[] = [
    {
      key: "period",
      header: "Period",
      sortValue: (run) => run.period_start,
      render: (run) => (
        <Link href={`/payroll/${run.id}`} className="font-bold text-primary">
          {run.period_start} – {run.period_end}
        </Link>
      ),
    },
    {
      key: "frequency",
      header: "Frequency",
      sortValue: (run) => run.frequency,
      render: (run) => (
        <span className="text-ink-soft capitalize">{FREQUENCY_LABEL[run.frequency] ?? run.frequency}</span>
      ),
    },
    {
      key: "employee_count",
      header: "Employees",
      align: "center",
      sortValue: (run) => run.employee_count,
      render: (run) => <span className="text-ink">{run.employee_count}</span>,
    },
    {
      key: "gross",
      header: "Gross",
      align: "right",
      sortValue: (run) => run.gross_kobo,
      render: (run) => <span className="font-bold text-ink">{formatKobo(BigInt(run.gross_kobo))}</span>,
    },
    {
      key: "net",
      header: "Net",
      align: "right",
      sortValue: (run) => run.net_kobo,
      render: (run) => <span className="font-bold text-ink">{formatKobo(BigInt(run.net_kobo))}</span>,
    },
    {
      key: "rule_version",
      header: "Rule version",
      sortValue: (run) => run.rule_version_id,
      render: (run) => <span className="text-ink-soft">{run.rule_version_id}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (run) => <PayRunStatusBadge status={run.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={payRuns}
      rowKey={(run) => run.id}
      emptyMessage="No payroll runs yet."
      rowClassName={() => "hover:bg-bg"}
    />
  );
}
