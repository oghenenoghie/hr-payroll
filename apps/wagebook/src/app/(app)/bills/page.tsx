import { redirect } from "next/navigation";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { BillForm } from "./BillForm";
import { approveVendorBill, rejectVendorBill, payVendorBill } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function BillsPage() {
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
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "accountant")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const { data: bills } = await supabase
    .from("vendor_bills")
    .select("*, vendors(name)")
    .order("created_at", { ascending: false });

  const { data: vendors } = await supabase.from("vendors").select("id, name").eq("status", "active").order("name");

  const pending = (bills ?? []).filter((b) => b.status === "pending_approval");
  const approved = (bills ?? []).filter((b) => b.status === "approved");
  const rest = (bills ?? []).filter((b) => b.status === "rejected" || b.status === "paid");

  const csv = toCsv(
    ["Vendor", "Description", "Bill Number", "Amount (NGN)", "Bill Date", "Due Date", "Status"],
    (bills ?? []).map((bill) => [
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
          {bills && bills.length > 0 && <ExportCsvButton csv={csv} filename="vendor-bills.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Vendor bills</h1>
        <p className="text-[13px] text-ink-soft">
          Approving a bill posts the liability to the general ledger immediately; paying it settles that liability
          against cash. Every step is a real, balanced journal entry — see the audit log for the postings.
        </p>
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
                          <form action={approveVendorBill.bind(null, bill.id)}>
                            <button type="submit" className="text-[12px] font-bold text-good">
                              Approve
                            </button>
                          </form>
                          <form action={rejectVendorBill.bind(null, bill.id)}>
                            <button type="submit" className="text-[12px] font-bold text-bad">
                              Reject
                            </button>
                          </form>
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
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Vendor</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-left`}>Due date</th>
                  {canManage && <th className={thClass}></th>}
                </tr>
              </thead>
              <tbody>
                {approved.map((bill) => (
                  <tr key={bill.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} font-bold text-ink`}>{bill.vendors?.name ?? "—"}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.due_date ?? "—"}</td>
                    {canManage && (
                      <td className={`${tdClass} text-right`}>
                        <form action={payVendorBill.bind(null, bill.id)}>
                          <button type="submit" className="text-[12px] font-bold text-primary">
                            Mark as paid
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">All bills</span>
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
