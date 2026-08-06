"use client";

import { useActionState, useMemo, useState } from "react";
import { NG_2026_1, UnknownWhtCategoryError, computeVendorInvoiceTotals, naira } from "@plutus/compliance";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { formatKobo } from "@/lib/format";
import { createVendorBill } from "./actions";

type Vendor = { id: string; name: string };

const inputClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

const rv = NG_2026_1;

const VAT_CATEGORY_OPTIONS = [
  { value: "standard", label: `Standard-rated (${(Number(rv.vat.standardRateScaled) / 10_000).toLocaleString("en-NG")}%)` },
  ...rv.vat.exemptCategories.map((category) => ({
    value: category,
    label: `${category.replace(/_/g, " ")} (exempt)`,
  })),
];

const WHT_CATEGORY_OPTIONS = Object.entries(rv.wht.ratesScaledByCategory).map(([category, rateScaled]) => ({
  value: category,
  label: `${category.replace(/_/g, " ")} (${(Number(rateScaled) / 10_000).toLocaleString("en-NG")}%)`,
}));

export function BillForm({ vendors }: { vendors: Vendor[] }) {
  const [state, formAction] = useActionState(createVendorBill, null);
  const [subtotal, setSubtotal] = useState("");
  const [vatCategory, setVatCategory] = useState("standard");
  const [whtCategory, setWhtCategory] = useState(WHT_CATEGORY_OPTIONS[0]?.value ?? "");

  const preview = useMemo(() => {
    const subtotalNaira = Number(subtotal);
    if (!(subtotalNaira > 0) || !whtCategory) return null;
    try {
      return computeVendorInvoiceTotals({ subtotalKobo: naira(subtotalNaira), vatCategory, whtCategory }, rv);
    } catch (err) {
      if (err instanceof UnknownWhtCategoryError) return null;
      throw err;
    }
  }, [subtotal, vatCategory, whtCategory]);

  if (vendors.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        Add a vendor from{" "}
        <a href="/vendors" className="font-bold text-primary">
          Vendors
        </a>{" "}
        first, then come back here to raise a bill against them.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Bill raised, pending approval." : undefined} />
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="vendor_id">
          Vendor
        </label>
        <select id="vendor_id" name="vendor_id" defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose a vendor
          </option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </div>
      <FormField label="Description" name="description" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bill number" name="bill_number" required={false} />
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="subtotal">
            Subtotal (₦, VAT-exclusive)
          </label>
          <input
            id="subtotal"
            name="subtotal"
            type="number"
            min="0"
            step="0.01"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="vat_category">
            VAT category
          </label>
          <select
            id="vat_category"
            name="vat_category"
            value={vatCategory}
            onChange={(e) => setVatCategory(e.target.value)}
            className={inputClass}
          >
            {VAT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className={labelClass} htmlFor="wht_category">
            WHT category
          </label>
          <select
            id="wht_category"
            name="wht_category"
            value={whtCategory}
            onChange={(e) => setWhtCategory(e.target.value)}
            className={inputClass}
          >
            {WHT_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bill date" name="bill_date" type="date" />
        <FormField label="Due date" name="due_date" type="date" required={false} />
      </div>

      {/* Client-side preview only — the server action recomputes these
          totals itself from the submitted subtotal/categories rather than
          trusting anything sent from here. */}
      {preview && (
        <div className="flex flex-col gap-1 rounded-panel border border-border bg-bg px-4 py-3 text-[13px]">
          <div className="flex items-center justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>{formatKobo(preview.subtotalKobo)}</span>
          </div>
          <div className="flex items-center justify-between text-ink-soft">
            <span>VAT{preview.vatExempt ? " (exempt)" : ""}</span>
            <span>{formatKobo(preview.vatKobo)}</span>
          </div>
          <div className="flex items-center justify-between font-bold text-ink">
            <span>Bill amount (posted to Accounts Payable)</span>
            <span>{formatKobo(preview.invoiceTotalKobo)}</span>
          </div>
          <div className="flex items-center justify-between text-ink-soft">
            <span>WHT withheld at payment</span>
            <span>−{formatKobo(preview.whtKobo)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1 font-extrabold text-ink">
            <span>Net payable to vendor</span>
            <span>{formatKobo(preview.netPayableToVendorKobo)}</span>
          </div>
        </div>
      )}

      <SubmitButton>Raise bill</SubmitButton>
    </form>
  );
}
