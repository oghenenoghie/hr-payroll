import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const RECENT_BILL_COUNT = 15;

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [{ data: vendor }, { data: bills }] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("vendor_bills")
      .select("id, bill_number, description, amount_kobo, wht_kobo, net_payable_kobo, bill_date, due_date, status")
      .eq("vendor_id", id)
      .order("bill_date", { ascending: false })
      .limit(RECENT_BILL_COUNT),
  ]);
  if (!vendor) notFound();

  // Approving a bill recognizes the full gross liability (amount_kobo) on
  // Accounts Payable — that's what's actually "owed" until paid. Paying it
  // settles that same gross amount, but only net_payable_kobo of it leaves
  // cash (the rest goes to WHT Payable), so "Paid" below reports the real
  // cash figure rather than the gross one. Pending/rejected bills never
  // posted anything, so they're excluded from every total here.
  const posted = (bills ?? []).filter((b) => b.status === "approved" || b.status === "paid");
  const totalBilledKobo = posted.reduce((sum, b) => sum + BigInt(b.amount_kobo), 0n);
  const outstandingKobo = posted
    .filter((b) => b.status === "approved")
    .reduce((sum, b) => sum + BigInt(b.amount_kobo), 0n);
  const paidNetKobo = posted
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + BigInt(b.net_payable_kobo), 0n);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-extrabold text-ink">{vendor.name}</h1>
          <span
            className={`inline-block rounded-badge border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.03em] ${
              vendor.status === "active" ? "border-good bg-good-tint text-good" : "border-border bg-bg text-ink-soft"
            }`}
          >
            {vendor.status}
          </span>
        </div>
        <p className="text-[13px] text-ink-soft">
          {vendor.contact_email ?? vendor.contact_phone ?? "No contact on file"}
          {vendor.bank_name ? ` · ${vendor.bank_name} · ${vendor.bank_account_number ?? "—"}` : ""}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Billed (lifetime)</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(totalBilledKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Outstanding</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(outstandingKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Paid (net of WHT)</span>
          <p className="mt-1 text-[20px] font-extrabold text-ink">{formatKobo(paidNetKobo)}</p>
        </div>
      </div>

      <div className="flex gap-3">
        {canManage && (
          <Link
            href={`/bills?vendor_id=${vendor.id}#raise-bill`}
            className="w-fit rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
          >
            Raise a bill for {vendor.name}
          </Link>
        )}
        <Link
          href={`/vendors/${vendor.id}/statement`}
          className="w-fit rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
        >
          Full statement →
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Recent bills ({(bills ?? []).length})
        </span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Bill #</th>
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={`${thClass} text-right`}>WHT</th>
                <th className={`${thClass} text-left`}>Bill date</th>
                <th className={`${thClass} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills && bills.length > 0 ? (
                bills.map((bill) => (
                  <tr key={bill.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{bill.bill_number}</td>
                    <td className={`${tdClass} text-ink`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(bill.wht_kobo))}</td>
                    <td className={`${tdClass} text-ink-soft`}>{bill.bill_date}</td>
                    <td className={`${tdClass} text-center`}>
                      <VendorBillStatusBadge status={bill.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                    No bills raised for this vendor yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link href="/vendors" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Vendors
      </Link>
    </div>
  );
}
