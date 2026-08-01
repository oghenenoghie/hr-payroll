"use client";

import { useState, useTransition } from "react";
import { formatKobo } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { payVendorBillsBatch } from "./actions";

type ApprovedBill = {
  id: string;
  description: string;
  amount_kobo: number;
  due_date: string | null;
  vendors: { name: string } | null;
};

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

// Select several approved bills and pay them together in one action —
// one aggregate journal entry for the whole batch (see
// pay_vendor_bills_batch), the same way a pay run posts once per run
// rather than once per employee — instead of clicking "mark as paid" on
// each bill individually.
export function ApprovedBillsTable({ bills, canManage }: { bills: ApprovedBill[]; canManage: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
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

  function runBatchPay() {
    setConfirming(false);
    startTransition(async () => {
      await payVendorBillsBatch(Array.from(selected));
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {canManage && <th className={thClass}></th>}
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>Description</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-left`}>Due date</th>
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
                <td className={`${tdClass} font-bold text-ink`}>{bill.vendors?.name ?? "—"}</td>
                <td className={`${tdClass} text-ink-soft`}>{bill.description}</td>
                <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                <td className={`${tdClass} text-ink-soft`}>{bill.due_date ?? "—"}</td>
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
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white disabled:opacity-60"
          >
            {pending ? "Paying…" : "Pay selected"}
          </button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Pay the selected bills?"
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will be marked paid in one batch, debiting Accounts Payable and crediting Cash & Bank in a single journal entry.`}
          confirmLabel="Pay bills"
          tone="primary"
          onConfirm={runBatchPay}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
