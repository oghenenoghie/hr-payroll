import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { LeaveStatusBadge, LeaveEncashmentStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { approveLeave, rejectLeave, approveLeaveEncashment, rejectLeaveEncashment } from "./actions";

const PAGE_SIZE = 25;

type PendingLeave = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  employees: { full_name: string; annual_leave_balance_days: number } | null;
};

type SettledLeave = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  employees: { full_name: string } | null;
};

type PendingEncashment = {
  id: string;
  days_requested: number;
  status: string;
  employees: { full_name: string; annual_leave_balance_days: number } | null;
};

type SettledEncashment = {
  id: string;
  days_requested: number;
  status: string;
  employees: { full_name: string } | null;
};

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; encashment_page?: string }>;
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

  const { page: pageParam, encashment_page: encashmentPageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);
  const requestedEncashmentPage = Math.max(1, Number(encashmentPageParam) || 1);

  // Pending is an actionable work queue — every request needs to stay
  // visible, so that fetch is unbounded (naturally small, capped by how
  // many requests are actually awaiting a decision at once). Only the
  // settled history (approved/rejected) grows without bound over the
  // org's lifetime, so that's the part that's paginated.
  const [
    { data: pendingRaw },
    { data: restRaw, count: restCount },
    { data: pendingEncashmentsRaw },
    { data: restEncashmentsRaw, count: restEncashmentsCount },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, status, employees(full_name, annual_leave_balance_days)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
    // Only ever non-empty for admin/payroll_manager viewers — the RLS policy
    // restricts visibility the same way loans/expenses/overtime approvals do,
    // since encashment converts leave into money.
    supabase
      .from("leave_encashment_requests")
      .select("id, days_requested, status, employees(full_name, annual_leave_balance_days)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("leave_encashment_requests")
      .select("id, days_requested, status, employees(full_name)", { count: "exact" })
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .range((requestedEncashmentPage - 1) * PAGE_SIZE, requestedEncashmentPage * PAGE_SIZE - 1),
  ]);

  const pending = pendingRaw ?? [];
  const rest = restRaw ?? [];
  const pendingEncashments = pendingEncashmentsRaw ?? [];
  const restEncashments = restEncashmentsRaw ?? [];

  const totalRest = restCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRest / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const totalRestEncashments = restEncashmentsCount ?? 0;
  const totalEncashmentPages = Math.max(1, Math.ceil(totalRestEncashments / PAGE_SIZE));
  const currentEncashmentPage = Math.min(requestedEncashmentPage, totalEncashmentPages);

  function pageHref(page: number): string {
    return `/leave?page=${page}${requestedEncashmentPage > 1 ? `&encashment_page=${requestedEncashmentPage}` : ""}`;
  }

  function encashmentPageHref(page: number): string {
    return `/leave?encashment_page=${page}${requestedPage > 1 ? `&page=${requestedPage}` : ""}`;
  }

  // Scoped to what's actually on screen — the pending queue plus this
  // page of settled history — never a separate full-history re-query.
  const leaveCsv = toCsv(
    ["Employee", "Type", "Start Date", "End Date", "Days", "Status"],
    [...pending, ...rest].map((leave) => [
      leave.employees?.full_name ?? "—",
      leave.leave_type,
      leave.start_date,
      leave.end_date,
      leave.days,
      leave.status,
    ]),
  );

  const encashmentCsv = toCsv(
    ["Employee", "Days Requested", "Status"],
    [...pendingEncashments, ...restEncashments].map((request) => [
      request.employees?.full_name ?? "—",
      request.days_requested,
      request.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave &amp; Attendance</span>
          <ExportCsvButton csv={leaveCsv} filename="leave-requests.csv" label="Export this page (CSV)" />
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Policies, balances and approvals tied to payroll</h1>
        <p className="text-[13px] text-ink-soft">
          Approving annual leave decrements the employee&apos;s balance immediately. Unpaid leave is deducted from
          gross pay — and re-taxed — through the next pay run.
        </p>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <PendingLeaveTable pending={pending} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">History</span>
        <SettledLeaveTable leaves={rest} />
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages} · {totalRest} record{totalRest === 1 ? "" : "s"} total
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

      <header className="flex flex-col gap-1 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Leave Encashment</span>
          <ExportCsvButton csv={encashmentCsv} filename="leave-encashments.csv" label="Export this page (CSV)" />
        </div>
        <p className="text-[13px] text-ink-soft">
          Cashing out unused annual leave for money while still employed. Approving decrements the balance
          immediately and atomically rejects if it&apos;s insufficient — the payout itself is taxable and goes out
          through the next pay run.
        </p>
      </header>

      {pendingEncashments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending requests</span>
          <PendingEncashmentTable pending={pendingEncashments} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Encashment history</span>
        <SettledEncashmentTable requests={restEncashments} />
        {totalEncashmentPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentEncashmentPage} of {totalEncashmentPages} · {totalRestEncashments} record
              {totalRestEncashments === 1 ? "" : "s"} total
            </span>
            <div className="flex gap-3">
              {currentEncashmentPage > 1 ? (
                <Link href={encashmentPageHref(currentEncashmentPage - 1)} className="text-[12.5px] font-bold text-primary">
                  ← Previous
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
              )}
              {currentEncashmentPage < totalEncashmentPages ? (
                <Link href={encashmentPageHref(currentEncashmentPage + 1)} className="text-[12.5px] font-bold text-primary">
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

function PendingLeaveTable({ pending }: { pending: PendingLeave[] }) {
  const columns: DataTableColumn<PendingLeave>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (leave) => leave.employees?.full_name ?? "",
      render: (leave) => <span className="font-bold text-ink">{leave.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortValue: (leave) => leave.leave_type,
      render: (leave) => <span className="text-ink-soft capitalize">{leave.leave_type}</span>,
    },
    {
      key: "dates",
      header: "Dates",
      sortValue: (leave) => leave.start_date,
      render: (leave) => (
        <span className="text-ink-soft">
          {leave.start_date} – {leave.end_date}
        </span>
      ),
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      sortValue: (leave) => leave.days,
      render: (leave) => <span className="text-ink">{leave.days}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (leave) => (
        <span className="text-ink-soft">
          {leave.employees ? Number(leave.employees.annual_leave_balance_days) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (leave) => (
        <div className="flex justify-end gap-2">
          <ConfirmActionButton
            action={approveLeave.bind(null, leave.id)}
            label="Approve"
            tone="primary"
            className="text-[12px] font-bold text-good disabled:opacity-50"
            confirmTitle="Approve this leave request?"
            confirmMessage={`${leave.employees?.full_name ?? "This employee"}'s ${leave.leave_type} leave (${leave.start_date} – ${leave.end_date}, ${leave.days} day${leave.days === 1 ? "" : "s"}) will be approved and their balance updated immediately.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={rejectLeave.bind(null, leave.id)}
            label="Reject"
            confirmTitle="Reject this leave request?"
            confirmMessage={`${leave.employees?.full_name ?? "This employee"}'s ${leave.leave_type} leave (${leave.start_date} – ${leave.end_date}) will be rejected.`}
            confirmLabel="Reject"
          />
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={pending} rowKey={(leave) => leave.id} />;
}

function SettledLeaveTable({ leaves }: { leaves: SettledLeave[] }) {
  const columns: DataTableColumn<SettledLeave>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (leave) => leave.employees?.full_name ?? "",
      render: (leave) => <span className="font-bold text-ink">{leave.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortValue: (leave) => leave.leave_type,
      render: (leave) => <span className="text-ink-soft capitalize">{leave.leave_type}</span>,
    },
    {
      key: "dates",
      header: "Dates",
      sortValue: (leave) => leave.start_date,
      render: (leave) => (
        <span className="text-ink-soft">
          {leave.start_date} – {leave.end_date}
        </span>
      ),
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      sortValue: (leave) => leave.days,
      render: (leave) => <span className="text-ink">{leave.days}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (leave) => <LeaveStatusBadge status={leave.status} />,
    },
  ];

  return (
    <DataTable columns={columns} rows={leaves} rowKey={(leave) => leave.id} emptyMessage="No leave history yet." />
  );
}

function PendingEncashmentTable({ pending }: { pending: PendingEncashment[] }) {
  const columns: DataTableColumn<PendingEncashment>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (request) => request.employees?.full_name ?? "",
      render: (request) => <span className="font-bold text-ink">{request.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "days_requested",
      header: "Days requested",
      align: "right",
      sortValue: (request) => request.days_requested,
      render: (request) => <span className="text-ink">{request.days_requested}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (request) => (
        <span className="text-ink-soft">
          {request.employees ? Number(request.employees.annual_leave_balance_days) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (request) => (
        <div className="flex justify-end gap-2">
          <ConfirmActionButton
            action={approveLeaveEncashment.bind(null, request.id)}
            label="Approve"
            tone="primary"
            className="text-[12px] font-bold text-good disabled:opacity-50"
            confirmTitle="Approve this leave encashment?"
            confirmMessage={`${request.employees?.full_name ?? "This employee"}'s request to cash out ${request.days_requested} day${request.days_requested === 1 ? "" : "s"} will be approved. Their balance is decremented immediately, and the taxable payout goes out with the next pay run.`}
            confirmLabel="Approve"
          />
          <ConfirmActionButton
            action={rejectLeaveEncashment.bind(null, request.id)}
            label="Reject"
            confirmTitle="Reject this leave encashment?"
            confirmMessage={`${request.employees?.full_name ?? "This employee"}'s request to cash out ${request.days_requested} day${request.days_requested === 1 ? "" : "s"} will be rejected.`}
            confirmLabel="Reject"
          />
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={pending} rowKey={(request) => request.id} />;
}

function SettledEncashmentTable({ requests }: { requests: SettledEncashment[] }) {
  const columns: DataTableColumn<SettledEncashment>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (request) => request.employees?.full_name ?? "",
      render: (request) => <span className="font-bold text-ink">{request.employees?.full_name ?? "—"}</span>,
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      sortValue: (request) => request.days_requested,
      render: (request) => <span className="text-ink">{request.days_requested}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (request) => <LeaveEncashmentStatusBadge status={request.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={requests}
      rowKey={(request) => request.id}
      emptyMessage="No leave encashment history yet."
    />
  );
}
