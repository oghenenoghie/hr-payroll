import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";
import { FREQUENCY_LABEL } from "@/lib/accounts";
import { PayRunStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
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

export default async function PayrollPage() {
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

  const { data: payRuns } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, frequency, employee_count, gross_kobo, net_kobo, rule_version_id, status")
    .order("created_at", { ascending: false });

  const csv = toCsv(
    ["Period Start", "Period End", "Frequency", "Employees", "Gross (NGN)", "Net (NGN)", "Rule Version", "Status"],
    (payRuns ?? []).map((run) => [
      run.period_start,
      run.period_end,
      FREQUENCY_LABEL[run.frequency] ?? run.frequency,
      run.employee_count,
      toNaira(BigInt(run.gross_kobo)).toFixed(2),
      toNaira(BigInt(run.net_kobo)).toFixed(2),
      run.rule_version_id,
      run.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
          <h1 className="text-[22px] font-extrabold text-ink">Multi-frequency runs with full audit trail</h1>
        </div>
        <div className="flex items-center gap-2">
          {payRuns && payRuns.length > 0 && <ExportCsvButton csv={csv} filename="payroll-runs.csv" />}
          <Link
            href="/payroll/new"
            className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            + Run payroll
          </Link>
        </div>
      </header>

      <PayRunsTable payRuns={payRuns ?? []} />
    </div>
  );
}

function PayRunsTable({ payRuns }: { payRuns: PayRunRow[] }) {
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
