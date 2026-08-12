"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatKobo } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { useToast } from "@/components/Toast";
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
  const { showToast } = useToast();

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
      const result = await (kind === "approve" ? approveVendorBillsBatch(ids) : rejectVendorBillsBatch(ids));
      setSelected(new Set());
      const verb = kind === "approve" ? "approved" : "rejected";
      if (result.errors.length === 0) {
        showToast(`${result.succeededCount} bill${result.succeededCount === 1 ? "" : "s"} ${verb}`, "good");
      } else if (result.succeededCount === 0) {
        showToast(result.errors[0], "bad");
      } else {
        showToast(
          `${result.succeededCount} bill${result.succeededCount === 1 ? "" : "s"} ${verb}, ${result.errors.length} failed: ${result.errors[0]}`,
          "bad",
        );
      }
    });
  }

  async function approveOne(bill: PendingBill) {
    const result = await approveVendorBill(bill.id);
    if (result?.error) {
      showToast(result.error, "bad");
    } else {
      showToast("Bill approved", "good");
    }
  }

  async function rejectOne(bill: PendingBill) {
    const result = await rejectVendorBill(bill.id);
    if (result?.error) {
      showToast(result.error, "bad");
    } else {
      showToast("Bill rejected", "good");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 md:hidden">
        {bills.map((bill) => (
          <div key={bill.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {canManage && (
                  <input
                    type="checkbox"
                    checked={selected.has(bill.id)}
                    disabled={pending}
                    onChange={() => toggle(bill.id)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                )}
                <div className="flex flex-col gap-0.5">
                  <Link href={`/bills/${bill.id}`} className="text-[13px] font-bold text-primary">
                    {bill.bill_number ?? "View"}
                  </Link>
                  {bill.vendors?.name ? (
                    <Link href={`/vendors/${bill.vendor_id}`} className="text-[12.5px] font-bold text-ink">
                      {bill.vendors.name}
                    </Link>
                  ) : (
                    <span className="text-[12.5px] font-bold text-ink">—</span>
                  )}
                </div>
              </div>
              <span className="text-[12.5px] font-bold text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-soft">{bill.description}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
              <span>{bill.bill_date}</span>
              <span>Net {formatKobo(BigInt(bill.net_payable_kobo))}</span>
            </div>
            {canManage && (
              <div className="mt-3 flex justify-end gap-3 border-t border-border pt-3">
                <ConfirmActionButton
                  action={() => approveOne(bill)}
                  label="Approve"
                  tone="primary"
                  className="text-[12px] font-bold text-good disabled:opacity-50"
                  confirmTitle="Approve this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} (${formatKobo(BigInt(bill.amount_kobo))}) will be approved. If this org has a multi-step chain configured for bills, this may only advance it to the next step rather than fully approving it.`}
                  confirmLabel="Approve"
                />
                <ConfirmActionButton
                  action={() => rejectOne(bill)}
                  label="Reject"
                  confirmTitle="Reject this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} will be rejected.`}
                  confirmLabel="Reject"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-card border border-border bg-surface md:block">
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
                        action={() => approveOne(bill)}
                        label="Approve"
                        tone="primary"
                        className="text-[12px] font-bold text-good disabled:opacity-50"
                        confirmTitle="Approve this bill?"
                        confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} (${formatKobo(BigInt(bill.amount_kobo))}) will be approved. If this org has a multi-step chain configured for bills, this may only advance it to the next step rather than fully approving it.`}
                        confirmLabel="Approve"
                      />
                      <ConfirmActionButton
                        action={() => rejectOne(bill)}
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
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will each be approved individually. A bill on a multi-step chain may only advance rather than fully approve.`}
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
