import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { OvertimeStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { approveOvertime, rejectOvertime } from "./actions";

const PAGE_SIZE = 25;

type PendingOvertime = {
  id: string;
  work_date: string;
  hours: number;
  reason: string | null;
  status: string;
  employees: { full_name: string } | null;
};

type SettledOvertime = {
  id: string;
  work_date: string;
  hours: number;
  rate_multiplier_bps: number | null;
  status: string;
  employees: { full_name: string } | null;
};

export default async function OvertimePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Pending is an actionable work queue — stays unbounded (naturally
  // small, capped by how many requests are actually awaiting a decision
  // at once). Only the settled history (approved/rejected) grows without
  // bound over the org's lifetime, so that's the part that's paginated.
  const [{ data: pendingRaw }, { data: restRaw, count }] = await Promise.all([
    supabase
      .from("overtime_requests")
      .select("id, work_date, hours, reason, status, employees(full_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("overtime_requests")
      .select("id, work_date, hours, reason, rate_multiplier_bps, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
  ]);

  const pending = pendingRaw ?? [];
  const rest = restRaw ?? [];

  const totalRest = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRest / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/overtime?page=${page}`;
  }

  const csv = toCsv(
    ["Employee", "Date", "Hours", "Reason", "Rate", "Status"],
    [
      ...pending.map((request) => ({ ...request, rate_multiplier_bps: null as number | null })),
      ...rest,
    ].map((request) => [
      request.employees?.full_name ?? "—",
      request.work_date,
      Number(request.hours),
      request.reason ?? "",
      request.status === "rejected" || request.status === "pending" || request.rate_multiplier_bps === null
        ? ""
        : `${request.rate_multiplier_bps / 100}x`,
      request.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Overtime Management</span>
          <ExportCsvButton csv={csv} filename="overtime-requests.csv" label="Export this page (CSV)" />
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Requests, approvals and pay rate</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a request sets its pay rate — 1.5× is the standard weekday multiplier; 2× is available for
          holiday or premium overtime. An approved request is paid out in the next pay run.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <PendingOvertimeTable pending={pending} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
        <SettledOvertimeTable requests={rest} />
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} request{totalRest === 1 ? "" : "s"} total
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
    </div>
  );
}

function PendingOvertimeTable({ pending }: { pending: PendingOvertime[] }) {
  const columns: DataTableColumn<PendingOvertime>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (request) => request.employees?.full_name ?? "",
      render: (request) => <span className="font-bold text-ink">{request.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortValue: (request) => request.work_date,
      render: (request) => <span className="text-ink-soft">{request.work_date}</span>,
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      sortValue: (request) => request.hours,
      render: (request) => <span className="text-ink">{Number(request.hours)}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      render: (request) => <span className="text-ink-soft">{request.reason ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (request) => (
        <div className="flex justify-end gap-2">
          <ConfirmActionButton
            action={approveOvertime.bind(null, request.id, 150)}
            label="Approve · 1.5×"
            tone="primary"
            className="text-[12px] font-bold text-good disabled:opacity-50"
            confirmTitle="Approve at 1.5× rate?"
            confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be approved at 1.5× and paid out in the next pay run.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={approveOvertime.bind(null, request.id, 200)}
            label="Approve · 2×"
            tone="primary"
            className="text-[12px] font-bold text-good disabled:opacity-50"
            confirmTitle="Approve at 2× rate?"
            confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be approved at 2× and paid out in the next pay run.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={rejectOvertime.bind(null, request.id)}
            label="Reject"
            confirmTitle="Reject this overtime request?"
            confirmMessage={`${request.employees?.full_name ?? "This employee"}'s ${Number(request.hours)} overtime hours on ${request.work_date} will be rejected.`}
            confirmLabel="Reject"
          />
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={pending} rowKey={(request) => request.id} />;
}

function SettledOvertimeTable({ requests }: { requests: SettledOvertime[] }) {
  const columns: DataTableColumn<SettledOvertime>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (request) => request.employees?.full_name ?? "",
      render: (request) => <span className="font-bold text-ink">{request.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortValue: (request) => request.work_date,
      render: (request) => <span className="text-ink-soft">{request.work_date}</span>,
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      sortValue: (request) => request.hours,
      render: (request) => <span className="text-ink">{Number(request.hours)}</span>,
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (request) => (
        <span className="text-ink-soft">
          {request.status === "rejected" || request.rate_multiplier_bps === null
            ? "—"
            : `${request.rate_multiplier_bps / 100}×`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (request) => <OvertimeStatusBadge status={request.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={requests}
      rowKey={(request) => request.id}
      emptyMessage="No overtime history yet."
    />
  );
}
