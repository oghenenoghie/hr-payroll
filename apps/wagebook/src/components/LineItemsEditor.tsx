"use client";

import { useMemo, useState } from "react";
import { formatKobo, formatPercent } from "@/lib/format";

type DraftLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};

const EMPTY_LINE: DraftLine = { description: "", quantity: "1", unitPrice: "", discount: "0" };

function toKobo(nairaStr: string): number {
  const n = Number(nairaStr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const fieldLabelClass = "text-[10.5px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const fieldInputClass =
  "w-full rounded-control border border-border bg-surface px-2 py-[7px] text-[13px] text-ink outline-none focus:border-primary";

/** Repeatable description/qty/unit-price/discount rows, live-computing a
 * subtotal/VAT/total preview as the user types and serializing the lines
 * into a hidden JSON field the server action reads. This preview is
 * convenience only — the actual totals are always recomputed and
 * validated server-side (see create_customer_invoice_with_lines /
 * create_vendor_bill_with_lines), never trusted from here. Shared between
 * InvoiceForm and BillForm since both need the identical editor. */
export function LineItemsEditor({ fieldName, vatRateScaled }: { fieldName: string; vatRateScaled: number }) {
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const { subtotalKobo, vatKobo, totalKobo, payload } = useMemo(() => {
    const computed = lines.map((line) => {
      const quantity = Number(line.quantity) || 0;
      const unitPriceKobo = toKobo(line.unitPrice);
      const discountKobo = toKobo(line.discount);
      const lineTotalKobo = Math.max(0, Math.round(quantity * unitPriceKobo) - discountKobo);
      return { description: line.description, quantity, unitPriceKobo, discountKobo, lineTotalKobo };
    });
    const subtotal = computed.reduce((sum, line) => sum + line.lineTotalKobo, 0);
    const vat = Math.round((subtotal * vatRateScaled) / 1_000_000);
    const payload = computed.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit_price_kobo: line.unitPriceKobo,
      discount_kobo: line.discountKobo,
    }));
    return { subtotalKobo: subtotal, vatKobo: vat, totalKobo: subtotal + vat, payload };
  }, [lines, vatRateScaled]);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={fieldName} value={JSON.stringify(payload)} />

      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Line items</span>
      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_70px_100px_100px_auto] items-end gap-2 rounded-panel border border-border bg-bg p-3"
          >
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Description</span>
              <input
                value={line.description}
                onChange={(e) => updateLine(index, { description: e.target.value })}
                className={fieldInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Qty</span>
              <input
                type="number"
                min="0"
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
                className={fieldInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Unit price (₦)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={line.unitPrice}
                onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                className={fieldInputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Discount (₦)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={line.discount}
                onChange={(e) => updateLine(index, { discount: e.target.value })}
                className={fieldInputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
              className="rounded-control border border-border px-2 py-[7px] text-[12px] font-bold text-bad disabled:opacity-30"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addLine} className="w-fit text-[12.5px] font-bold text-primary">
        + Add line
      </button>

      <div className="flex flex-col gap-1 rounded-panel border border-border bg-bg p-3 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">Subtotal</span>
          <span className="font-bold text-ink">{formatKobo(BigInt(subtotalKobo))}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-soft">VAT ({formatPercent(BigInt(vatRateScaled))})</span>
          <span className="font-bold text-ink">{formatKobo(BigInt(vatKobo))}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1">
          <span className="font-bold text-ink">Total</span>
          <span className="font-extrabold text-ink">{formatKobo(BigInt(totalKobo))}</span>
        </div>
      </div>
    </div>
  );
}
