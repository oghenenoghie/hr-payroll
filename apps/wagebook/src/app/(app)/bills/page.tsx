import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { BillForm } from "./BillForm";
import { ApprovedBillsTable } from "./ApprovedBillsTable";
import { PendingBillsTable } from "./PendingBillsTable";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

const SETTLED_STATUSES = ["rejected", "paid", "cancelled"];
const SETTLED_STATUS_LABEL: Record<string, string> = {
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

type BillSearchParams = {
  page?: string;
  vendor_id?: string;
  status?: string;
  vendor?: string;
  from?: string;
  to?: string;
  q?: string;
};

export default async function BillsPage({ searchParams }: { searchParams: Promise<BillSearchParams> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    !membership ||
    (membership.role !== "admin" &&
      membership.role !== "payroll_manager" &&
      membership.role !== "accountant" &&
      membership.role !== "auditor")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const {
    page: pageParam,
    vendor_id: defaultVendorId,
    status: statusFilter,
    vendor: vendorFilter,
    from: fromFilter,
    to: toFilter,
    q: searchQuery,
  } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const settledStatuses =
    statusFilter && SETTLED_STATUSES.includes(statusFilter) ? [statusFilter] : SETTLED_STATUSES;

  // Pending/approved/scheduled are an actionable work queue — every item
  // needs to stay visible, so that fetch is unbounded (these naturally
  // stay small, capped by how many bills are actually mid-workflow at
  // once). Only the settled history (rejected/paid/cancelled) grows
  // without bound over the org's lifetime, so that's the part that's
  // actually searched, filtered, and paginated.
  let settledQuery = supabase
    .from("vendor_bills")
    .select("*, vendors(name)", { count: "exact" })
    .in("status", settledStatuses)
    .order("created_at", { ascending: false });
  if (vendorFilter) settledQuery = settledQuery.eq("vendor_id", vendorFilter);
  if (fromFilter) settledQuery = settledQuery.gte("bill_date", fromFilter);
  if (toFilter) settledQuery = settledQuery.lte("bill_date", toFilter);
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_]/g, (c) => `\\${c}`);
    settledQuery = settledQuery.or(`bill_number.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }
  settledQuery = settledQuery.range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1);

  const filtersActive = Boolean(statusFilter || vendorFilter || fromFilter || toFilter || searchQuery);

  const [{ data: queue }, { data: settled, count }, { data: vendors }] = await Promise.all([
    supabase
      .from("vendor_bills")
      .select("*, vendors(name)")
      .in("status", ["pending_approval", "approved", "scheduled"])
      .order("created_at", { ascending: false }),
    settledQuery,
    supabase.from("vendors").select("id, name").eq("status", "active").order("name"),
  ]);

  const pending = (queue ?? []).filter((b) => b.status === "pending_approval");
  // Approved and scheduled render in the same table — scheduling is an
  // optional waypoint on the way to paid, not a separate queue a viewer
  // needs to check in a different place.
  const awaitingPayment = (queue ?? []).filter((b) => b.status === "approved" || b.status === "scheduled");
  const rest = settled ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const totalSettled = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSettled / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function filterHref(overrides: Partial<BillSearchParams>): string {
    const merged: BillSearchParams = {
      status: statusFilter,
      vendor: vendorFilter,
      from: fromFilter,
      to: toFilter,
      q: searchQuery,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/bills?${qs}#settled` : "/bills#settled";
  }

  // Scoped to the actionable queue plus this page of settled history —
  // matches exactly what's on screen, never a separate full-history
  // re-query.
  const csv = toCsv(
    [
      "Vendor",
      "Description",
      "Bill Number",
      "Subtotal (NGN)",
      "VAT (NGN)",
      "Amount (NGN)",
      "WHT Withheld (NGN)",
      "Net Payable (NGN)",
      "Bill Date",
      "Due Date",
      "Status",
      "Scheduled Payment Date",
    ],
    [...pending, ...awaitingPayment, ...rest].map((bill) => [
      bill.vendors?.name ?? "—",
      bill.description,
      bill.bill_number ?? "",
      toNaira(BigInt(bill.subtotal_kobo)).toFixed(2),
      toNaira(BigInt(bill.vat_kobo)).toFixed(2),
      toNaira(BigInt(bill.amount_kobo)).toFixed(2),
      toNaira(BigInt(bill.wht_kobo)).toFixed(2),
      toNaira(BigInt(bill.net_payable_kobo)).toFixed(2),
      bill.bill_date,
      bill.due_date ?? "",
      bill.status,
      bill.scheduled_payment_date ?? "",
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
          {(pending.length > 0 || awaitingPayment.length > 0 || rest.length > 0) && (
            <ExportCsvButton csv={csv} filename="vendor-bills.csv" label="Export queue + this page (CSV)" />
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Vendor bills</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a bill posts the liability to the general ledger immediately; paying it settles that liability
          against cash. Every step is a real, balanced journal entry — see the audit log for the postings.
        </p>
        <Link href="/bills/recurring" className="mt-1 w-fit text-[12.5px] font-bold text-primary">
          Manage recurring bills →
        </Link>
      </header>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Pending approval</span>
          <PendingBillsTable bills={pending} canManage={canManage} />
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Approved — awaiting payment
          </span>
          <ApprovedBillsTable bills={awaitingPayment} canManage={canManage} today={today} />
        </div>
      )}

      <div id="settled" className="flex flex-col gap-2 scroll-mt-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Settled ({totalSettled} total)
        </span>

        <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4" action="/bills#settled">
          <div className="flex min-w-[180px] flex-1 flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              placeholder="Bill # or description"
              defaultValue={searchQuery}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter ?? ""}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            >
              <option value="">All settled</option>
              {SETTLED_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SETTLED_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="vendor">
              Vendor
            </label>
            <select
              id="vendor"
              name="vendor"
              defaultValue={vendorFilter ?? ""}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            >
              <option value="">All vendors</option>
              {(vendors ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="from">
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={fromFilter}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="to">
              To
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={toFilter}
              className="rounded-control border border-border bg-surface px-[13px] py-[9px] text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink">
            Filter
          </button>
          {filtersActive && (
            <Link href="/bills#settled" className="px-2 py-[9px] text-[12.5px] font-bold text-primary">
              Clear filters
            </Link>
          )}
        </form>

        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Bill #</th>
                <th className={`${thClass} text-left`}>Vendor</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rest.length > 0 ? (
                rest.map((bill) => (
                  <tr key={bill.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>
                      <Link href={`/bills/${bill.id}`} className="text-primary">
                        {bill.bill_number ?? "View"}
                      </Link>
                    </td>
                    <td className={`${tdClass} font-bold`}>
                      {bill.vendors?.name ? (
                        <Link href={`/vendors/${bill.vendor_id}`} className="text-primary">
                          {bill.vendors.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-center`}>
                      <VendorBillStatusBadge status={bill.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    {filtersActive ? "No bills match these filters." : "No settled bills yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-soft">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-3">
              {currentPage > 1 ? (
                <Link href={filterHref({ page: String(currentPage - 1) })} className="text-[12.5px] font-bold text-primary">
                  ← Previous
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
              )}
              {currentPage < totalPages ? (
                <Link href={filterHref({ page: String(currentPage + 1) })} className="text-[12.5px] font-bold text-primary">
                  Next →
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>

      {canManage && (
        <div id="raise-bill" className="rounded-card border border-border bg-surface p-6 scroll-mt-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Raise a bill</span>
          <div className="mt-3">
            <BillForm vendors={vendors ?? []} defaultVendorId={defaultVendorId} />
          </div>
        </div>
      )}
    </div>
  );
}
