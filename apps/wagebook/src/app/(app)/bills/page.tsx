import Link from "next/link";
import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { BillForm } from "./BillForm";
import { ApprovedBillsTable } from "./ApprovedBillsTable";
import { approveVendorBill, rejectVendorBill } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 25;

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  // Pending/approved are an actionable work queue — every item needs to
  // stay visible, so that fetch is unbounded (these naturally stay small,
  // capped by how many bills are actually mid-workflow at once). Only the
  // settled history (rejected/paid) grows without bound over the org's
  // lifetime, so that's the part that's actually paginated.
  const [{ data: queue }, { data: settled, count }, { data: vendors }] = await Promise.all([
    supabase
      .from("vendor_bills")
      .select("*, vendors(name)")
      .in("status", ["pending_approval", "approved"])
      .order("created_at", { ascending: false }),
    supabase
      .from("vendor_bills")
      .select("*, vendors(name)", { count: "exact" })
      .in("status", ["rejected", "paid"])
      .order("created_at", { ascending: false })
      .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1),
    supabase.from("vendors").select("id, name").eq("status", "active").order("name"),
  ]);

  const pending = (queue ?? []).filter((b) => b.status === "pending_approval");
  const approved = (queue ?? []).filter((b) => b.status === "approved");
  const rest = settled ?? [];

  const totalSettled = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSettled / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/bills?page=${page}`;
  }

  // Scoped to the actionable queue plus this page of settled history —
  // matches exactly what's on screen, never a separate full-history
  // re-query.
  const csv = toCsv(
    ["Vendor", "Description", "Bill Number", "Amount (NGN)", "Bill Date", "Due Date", "Status"],
    [...pending, ...approved, ...rest].map((bill) => [
      bill.vendors?.name ?? "—",
      bill.description,
      bill.bill_number ?? "",
      toNaira(BigInt(bill.amount_kobo)).toFixed(2),
      bill.bill_date,
      bill.due_date ?? "",
      bill.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
          {(pending.length > 0 || approved.length > 0 || rest.length > 0) && (
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
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Vendor</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-left`}>Bill date</th>
                  {canManage && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {pending.map((bill) => (
                  <tr key={bill.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{bill.vendors?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.bill_date}</td>
                    {canManage && (
                      <td className={`${tdClass} text-right`}>
                        <div className="flex justify-end gap-2">
                          <ConfirmActionButton
                            action={approveVendorBill.bind(null, bill.id)}
                            label="Approve"
                            tone="primary"
                            className="text-[12px] font-bold text-good disabled:opacity-50"
                            confirmTitle="Approve this bill?"
                            confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} (${formatKobo(BigInt(bill.amount_kobo))}) will be approved, debiting an expense account and crediting Accounts Payable immediately.`}
                            confirmLabel="Approve"
                          />
                          <ConfirmActionButton
                            action={rejectVendorBill.bind(null, bill.id)}
                            label="Reject"
                            confirmTitle="Reject this bill?"
                            confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} will be rejected.`}
                            confirmLabel="Reject"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Approved — awaiting payment
          </span>
          <ApprovedBillsTable bills={approved} canManage={canManage} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Settled ({totalSettled} total)
        </span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
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
                    <td className={`${tdClass} font-bold text-ink`}>{bill.vendors?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-center`}>
                      <VendorBillStatusBadge status={bill.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No settled bills yet.
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

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Raise a bill</span>
          <div className="mt-3">
            <BillForm vendors={vendors ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
