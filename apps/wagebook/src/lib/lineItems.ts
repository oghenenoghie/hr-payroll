import { naira } from "@plutus/compliance";

/**
 * Deliberately "lines only" — no VAT/WHT computation lives here. Rate
 * computation stays exactly where 20260811010000/20260812010000 already
 * put it: TypeScript, against a subtotal, owned by each parent form
 * (InvoiceForm/BillForm). A line's only job is to substantiate that
 * subtotal with a real description/quantity/price breakdown.
 */
export type LineItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPriceNaira: string;
  discountNaira: string;
};

export function emptyLineItem(): LineItemDraft {
  return { id: crypto.randomUUID(), description: "", quantity: "1", unitPriceNaira: "", discountNaira: "0" };
}

export function lineTotalKobo(line: LineItemDraft): number {
  const quantity = Number(line.quantity) || 0;
  const unitPriceKobo = Number(naira(Number(line.unitPriceNaira) || 0));
  const discountKobo = Number(naira(Number(line.discountNaira) || 0));
  const gross = Math.round(quantity * unitPriceKobo);
  return Math.max(0, gross - discountKobo);
}

export type SerializedLineItem = {
  description: string;
  quantity: number;
  unit_price_kobo: number;
  discount_kobo: number;
  line_total_kobo: number;
};

/** Blank rows (no description, or zero quantity) are dropped rather than
 * submitted — a user who added an extra row and never filled it in
 * shouldn't have to explicitly remove it first. */
export function serializeLineItems(lines: LineItemDraft[]): SerializedLineItem[] {
  return lines
    .filter((line) => line.description.trim().length > 0 && Number(line.quantity) > 0)
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unit_price_kobo: Number(naira(Number(line.unitPriceNaira) || 0)),
      discount_kobo: Number(naira(Number(line.discountNaira) || 0)),
      line_total_kobo: lineTotalKobo(line),
    }));
}

export function sumLineItemsKobo(lines: LineItemDraft[]): number {
  return serializeLineItems(lines).reduce((sum, line) => sum + line.line_total_kobo, 0);
}

/** Server-side counterpart to serializeLineItems — parses the hidden
 * field's JSON back out of FormData. Never trusts the shape: every field
 * is coerced and blank/zero-quantity rows are dropped the same way the
 * client already drops them, so a hand-crafted request can't smuggle in a
 * malformed line. */
export function parseLineItemsField(raw: FormDataEntryValue | null): SerializedLineItem[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        description: String(record?.description ?? "").trim(),
        quantity: Number(record?.quantity ?? 0),
        unit_price_kobo: Number(record?.unit_price_kobo ?? 0),
        discount_kobo: Number(record?.discount_kobo ?? 0),
        line_total_kobo: Number(record?.line_total_kobo ?? 0),
      };
    })
    .filter((item) => item.description.length > 0 && item.quantity > 0);
}
