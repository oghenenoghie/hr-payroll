"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatKobo } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { approveVendorBill, rejectVendorBill, approveVendorBillsBatch, rejectVendorBillsBatch } from "./actions";

type PendingBill = {
  id: string;
  vendor_id: string;
  bill_number: string | null;
  description: string;
  amount_kobo: number;
  wht_kobo: number;
  net_payable_kobo: number;
  bill_date: string;
  vendors: { name: string } | null;
};

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export function PendingBillsTable({ bills, canManage }: { bills: PendingBill[]; canManage: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedBills = bills.filter((bill) => selected.has(bill.id));
  const totalKobo = selectedBills.reduce((sum, bill) => sum + BigInt(bill.amount_kobo), 0n);

  function runBatch(kind: "approve" | "reject") {
    setConfirming(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      await (kind === "approve" ? approveVendorBillsBatch(ids) : rejectVendorBillsBatch(ids));
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {canManage && <th className={thClass}></th>}
              <th className={`${thClass} text-left`}>Bill #</th>
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>Description</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-right`}>WHT</th>
              <th className={`${thClass} text-right`}>Net payable</th>
              <th className={`${thClass} text-left`}>Bill date</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-b border-border last:border-b-0">
                {canManage && (
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      checked={selected.has(bill.id)}
                      disabled={pending}
                      onChange={() => toggle(bill.id)}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                )}
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
                <td className={`${tdClass} text-right text-ink-soft`}>{formatKobo(BigInt(bill.wht_kobo))}</td>
                <td className={`${tdClass} text-right font-bold text-ink`}>
                  {formatKobo(BigInt(bill.net_payable_kobo))}
                </td>
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

      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-[13px] font-bold text-ink">
            {selected.size} bill{selected.size === 1 ? "" : "s"} selected · {formatKobo(totalKobo)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming("reject")}
              className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-bad disabled:opacity-60"
            >
              {pending ? "Working…" : "Reject selected"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming("approve")}
              className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white disabled:opacity-60"
            >
              {pending ? "Working…" : "Approve selected"}
            </button>
          </div>
        </div>
      )}

      {confirming === "approve" && (
        <ConfirmDialog
          title="Approve the selected bills?"
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will each be approved individually, debiting an expense account and crediting Accounts Payable for its own amount.`}
          confirmLabel="Approve bills"
          tone="primary"
          onConfirm={() => runBatch("approve")}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "reject" && (
        <ConfirmDialog
          title="Reject the selected bills?"
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will be rejected. This can't be undone from here — a rejected bill would need to be raised again.`}
          confirmLabel="Reject bills"
          onConfirm={() => runBatch("reject")}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
