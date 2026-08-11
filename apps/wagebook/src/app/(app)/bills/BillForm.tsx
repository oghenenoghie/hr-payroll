"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import { createVendorBill } from "./actions";

type Vendor = { id: string; name: string };

export function BillForm({
  vendors,
  vatRateScaled,
  defaultVendorId,
}: {
  vendors: Vendor[];
  vatRateScaled: number;
  defaultVendorId?: string;
}) {
  const [state, formAction] = useActionState(createVendorBill, null);

  if (vendors.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        Add a vendor from{" "}
        <Link href="/vendors" className="font-bold text-primary">
          Vendors
        </Link>{" "}
        first, then come back here to raise a bill against them.
      </p>
    );
  }

  const preselected = defaultVendorId ? vendors.find((v) => v.id === defaultVendorId) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice
        message={
          state?.success
            ? `Bill raised as ${state.billNumber}, pending approval — subtotal, VAT and total were computed automatically.`
            : undefined
        }
      />
      {preselected && (
        <div className="rounded-panel border border-primary bg-primary-tint px-3 py-2 text-[12.5px] font-bold text-primary-dark">
          Raising a bill for {preselected.name}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="vendor_id">
          Vendor
        </label>
        <select
          id="vendor_id"
          name="vendor_id"
          defaultValue={defaultVendorId ?? ""}
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
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
        <FormField label="Bill date" name="bill_date" type="date" />
        <FormField label="Due date" name="due_date" type="date" required={false} />
      </div>
      <p className="-mt-1 text-[12px] text-ink-soft">
        The bill number is generated automatically once this bill is created.
      </p>
      <LineItemsEditor fieldName="lines" vatRateScaled={vatRateScaled} />
      <SubmitButton>Raise bill</SubmitButton>
    </form>
  );
}
