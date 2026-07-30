"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createVendorBill } from "./actions";

type Vendor = { id: string; name: string };

export function BillForm({ vendors }: { vendors: Vendor[] }) {
  const [state, formAction] = useActionState(createVendorBill, null);

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
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="vendor_id">
          Vendor
        </label>
        <select
          id="vendor_id"
          name="vendor_id"
          defaultValue=""
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
        <FormField label="Bill number" name="bill_number" required={false} />
        <FormField label="Amount (₦)" name="amount" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bill date" name="bill_date" type="date" />
        <FormField label="Due date" name="due_date" type="date" required={false} />
      </div>
      <SubmitButton>Raise bill</SubmitButton>
    </form>
  );
}
