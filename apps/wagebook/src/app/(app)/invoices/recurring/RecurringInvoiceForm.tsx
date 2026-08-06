"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { createRecurringInvoice } from "./actions";

type Customer = { id: string; name: string };

export function RecurringInvoiceForm({ customers }: { customers: Customer[] }) {
  const [state, formAction] = useActionState(createRecurringInvoice, null);

  if (customers.length === 0) {
    return (
      <p className="text-[13px] text-ink-soft">
        Add a customer from{" "}
        <a href="/customers" className="font-bold text-primary">
          Customers
        </a>{" "}
        first, then come back here to set up a recurring invoice.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <FormNotice
        message={
          state?.success
            ? "Recurring invoice set up. It'll raise a new draft invoice, ready to review and issue, on schedule."
            : undefined
        }
      />
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
        <FormField label="Amount (₦)" name="amount" type="number" />
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="cadence">
            Repeats
          </label>
          <select
            id="cadence"
            name="cadence"
            defaultValue="monthly"
            className="w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      </div>
      <FormField label="Next invoice date" name="next_invoice_date" type="date" />
      <SubmitButton>Set up recurring invoice</SubmitButton>
    </form>
  );
}
