"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { computeVat } from "@plutus/compliance";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import { formatKobo } from "@/lib/format";
import { emptyLineItem, sumLineItemsKobo, type LineItemDraft } from "@/lib/lineItems";
import { VAT_CATEGORY_OPTIONS, vatRuleVersion } from "@/lib/vatCategories";
import { createCustomerInvoice } from "./actions";

type Customer = { id: string; name: string };

const inputClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";

export function InvoiceForm({ customers, defaultCustomerId }: { customers: Customer[]; defaultCustomerId?: string }) {
  const [state, formAction] = useActionState(createCustomerInvoice, null);
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [vatCategory, setVatCategory] = useState("standard");

  const subtotalKobo = useMemo(() => sumLineItemsKobo(lines), [lines]);
  const preview = useMemo(() => {
    if (subtotalKobo <= 0) return null;
    const { vatKobo, exempt } = computeVat(BigInt(subtotalKobo), vatCategory, vatRuleVersion);
    return { subtotalKobo, vatKobo, exempt, totalKobo: subtotalKobo + Number(vatKobo) };
  }, [subtotalKobo, vatCategory]);

  if (customers.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        Add a customer from{" "}
        <Link href="/customers" className="font-bold text-primary">
          Customers
        </Link>{" "}
        first, then come back here to raise an invoice against them.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice message={state?.success ? "Invoice created as a draft." : undefined} />
      <div className="flex flex-col gap-2">
        <label className={labelClass} htmlFor="customer_id">
          Customer
        </label>
        <select id="customer_id" name="customer_id" defaultValue={defaultCustomerId ?? ""} className={inputClass}>
          <option value="" disabled>
            Choose a customer
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>
      <FormField label="Description" name="description" />
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
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Invoice date" name="invoice_date" type="date" />
        <FormField label="Due date" name="due_date" type="date" required={false} />
      </div>

      <LineItemsEditor value={lines} onChange={setLines} />

      {preview && (
        <div className="flex flex-col gap-1 rounded-panel border border-border bg-bg px-4 py-3 text-[13px]">
          <div className="flex items-center justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>{formatKobo(BigInt(preview.subtotalKobo))}</span>
          </div>
          <div className="flex items-center justify-between text-ink-soft">
            <span>VAT{preview.exempt ? " (exempt)" : ""}</span>
            <span>{formatKobo(preview.vatKobo)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1 font-extrabold text-ink">
            <span>Invoice total</span>
            <span>{formatKobo(BigInt(preview.totalKobo))}</span>
          </div>
        </div>
      )}

      <p className="text-[12px] text-ink-soft">An invoice number is assigned automatically once this invoice is created.</p>

      <SubmitButton>Create draft invoice</SubmitButton>
    </form>
  );
}
