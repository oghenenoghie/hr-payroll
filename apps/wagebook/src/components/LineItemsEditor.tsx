"use client";

import { formatKobo } from "@/lib/format";
import {
  emptyLineItem,
  lineTotalKobo,
  serializeLineItems,
  sumLineItemsKobo,
  type LineItemDraft,
} from "@/lib/lineItems";

const inputClass =
  "w-full rounded-control border border-border bg-surface px-[10px] py-[8px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function LineItemsEditor({
  value,
  onChange,
  fieldName = "lines",
}: {
  value: LineItemDraft[];
  onChange: (lines: LineItemDraft[]) => void;
  fieldName?: string;
}) {
  const update = (index: number, patch: Partial<LineItemDraft>) => {
    onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };
  const add = () => onChange([...value, emptyLineItem()]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>Line items</label>
      <div className="overflow-x-auto rounded-panel border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
              <th className="px-3 py-2">Description</th>
              <th className="w-20 px-2 py-2">Qty</th>
              <th className="w-32 px-2 py-2">Unit price (₦)</th>
              <th className="w-28 px-2 py-2">Discount (₦)</th>
              <th className="w-28 px-3 py-2 text-right">Total</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {value.map((line, index) => (
              <tr key={line.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => update(index, { description: e.target.value })}
                    placeholder="Description"
                    className={inputClass}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.quantity}
                    onChange={(e) => update(index, { quantity: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPriceNaira}
                    onChange={(e) => update(index, { unitPriceNaira: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.discountNaira}
                    onChange={(e) => update(index, { discountNaira: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="px-3 py-2 text-right font-bold text-ink">{formatKobo(BigInt(lineTotalKobo(line)))}</td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={value.length === 1}
                    aria-label="Remove line"
                    className="text-[15px] font-bold leading-none text-ink-soft hover:text-bad disabled:opacity-30"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="self-start text-[12.5px] font-bold text-primary">
        + Add line
      </button>
      <div className="flex items-center justify-between border-t border-border pt-2 text-[13px] font-bold text-ink">
        <span>Subtotal</span>
        <span>{formatKobo(BigInt(sumLineItemsKobo(value)))}</span>
      </div>
      <input type="hidden" name={fieldName} value={JSON.stringify(serializeLineItems(value))} readOnly />
    </div>
  );
}
