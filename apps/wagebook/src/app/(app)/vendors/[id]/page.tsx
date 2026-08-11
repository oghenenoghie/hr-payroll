import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";

const detailRow = "flex items-center justify-between gap-3 border-b border-border py-2 text-[13px] last:border-b-0";

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
      .select("id, bill_number, bill_date, due_date, amount_kobo, description, status, paid_at")
      .eq("vendor_id", id)
      .order("bill_date", { ascending: false }),
  ]);
  if (!vendor) notFound();

  const allBills = bills ?? [];
  const approvedBills = allBills.filter((b) => b.status === "approved");
  const paidBills = allBills.filter((b) => b.status === "paid");

  // A bill only affects what's owed once it's approved (liability
  // recognized) — matching the vendor statement's own convention, since
  // AP is full-payment-only here (no partial-bill-payments table), unlike
  // AR's derived-outstanding math.
  const totalBilledKobo = [...approvedBills, ...paidBills].reduce((sum, bill) => sum + BigInt(bill.amount_kobo), 0n);
  const totalPaidKobo = paidBills.reduce((sum, bill) => sum + BigInt(bill.amount_kobo), 0n);
  const outstandingKobo = approvedBills.reduce((sum, bill) => sum + BigInt(bill.amount_kobo), 0n);

  const recentPayments = paidBills
    .filter((b) => b.paid_at)
    .sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime())
    .slice(0, 20);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendors</span>
          <h1 className="text-[22px] font-extrabold text-ink">{vendor.name}</h1>
          <p className="text-[13px] text-ink-soft">
            {vendor.contact_email ?? vendor.contact_phone ?? "No contact on file"}
          </p>
        </div>
      </header>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/bills?vendor_id=${vendor.id}#raise-bill`}
            className="rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
          >
            + Create Bill
          </Link>
          <a href="#recent-bills" className="text-[13px] font-bold text-primary">
            View bills →
          </a>
          <Link href={`/vendors/${vendor.id}/statement`} className="text-[13px] font-bold text-primary">
            Full statement →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total billed</span>
          <p className="mt-1 text-[18px] font-extrabold text-ink">{formatKobo(totalBilledKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total paid</span>
          <p className="mt-1 text-[18px] font-extrabold text-good">{formatKobo(totalPaidKobo)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Outstanding</span>
          <p className={`mt-1 text-[18px] font-extrabold ${outstandingKobo > 0n ? "text-bad" : "text-ink"}`}>
            {formatKobo(outstandingKobo)}
          </p>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft"># Bills</span>
          <p className="mt-1 text-[18px] font-extrabold text-ink">{allBills.length}</p>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendor details</span>
        <div className="mt-3">
          <div className={detailRow}>
            <span className="text-ink-soft">Contact email</span>
            <span className="font-bold text-ink">{vendor.contact_email ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Contact phone</span>
            <span className="font-bold text-ink">{vendor.contact_phone ?? "—"}</span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Bank details</span>
            <span className="font-bold text-ink">
              {vendor.bank_name ? `${vendor.bank_name} · ${vendor.bank_account_number ?? "—"}` : "—"}
            </span>
          </div>
          <div className={detailRow}>
            <span className="text-ink-soft">Status</span>
            <span className="font-bold capitalize text-ink">{vendor.status}</span>
          </div>
        </div>
        {canManage && (
          <Link href="/vendors" className="mt-3 inline-block text-[12.5px] font-bold text-primary">
            Edit from Vendors →
          </Link>
        )}
      </div>

      <div id="recent-bills" className="scroll-mt-4 rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Bills</span>
        <div className="mt-3">
          {allBills.length > 0 ? (
            allBills.map((bill) => (
              <div key={bill.id} className={detailRow}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-ink">{bill.bill_number}</span>
                  <span className="text-[12px] text-ink-soft">{bill.description}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-soft">{bill.bill_date}</span>
                    <VendorBillStatusBadge status={bill.status} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-soft">No bills raised for this vendor yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payment history</span>
        <div className="mt-3">
          {recentPayments.length > 0 ? (
            recentPayments.map((bill) => (
              <div key={bill.id} className={detailRow}>
                <span className="text-ink-soft">{bill.bill_number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-ink-soft">{bill.paid_at?.slice(0, 10)}</span>
                  <span className="font-bold text-good">{formatKobo(BigInt(bill.amount_kobo))}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-ink-soft">No payments recorded for this vendor yet.</p>
          )}
        </div>
      </div>

      <Link href="/vendors" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Vendors
      </Link>
    </div>
  );
}
