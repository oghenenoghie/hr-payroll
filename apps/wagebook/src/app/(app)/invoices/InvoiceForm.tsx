"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createCustomerInvoice } from "./actions";

type Customer = { id: string; name: string };

export function InvoiceForm({ customers }: { customers: Customer[] }) {
  const [state, formAction] = useActionState(createCustomerInvoice, null);

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
        <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="customer_id">
          Customer
        </label>
        <select
          id="customer_id"
          name="customer_id"
          defaultValue=""
          className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
        >
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
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Invoice number" name="invoice_number" required={false} />
        <FormField label="Amount (₦)" name="amount" type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Invoice date" name="invoice_date" type="date" />
        <FormField label="Due date" name="due_date" type="date" required={false} />
      </div>
      <SubmitButton>Create draft invoice</SubmitButton>
    </form>
  );
}
