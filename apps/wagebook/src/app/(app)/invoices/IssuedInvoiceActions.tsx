"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/AuthCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { receiveCustomerPayment, issueCreditNote } from "./actions";

export function IssuedInvoiceActions({
  invoiceId,
  invoiceDescription,
  customerName,
  outstandingNaira,
}: {
  invoiceId: string;
  invoiceDescription: string;
  customerName: string;
  outstandingNaira: string;
}) {
  const [paymentState, paymentAction] = useActionState(
    (prevState: { error?: string } | null, formData: FormData) => receiveCustomerPayment(invoiceId, prevState, formData),
    null,
  );
  const [creditNoteState, creditNoteAction] = useActionState(
    (prevState: { error?: string } | null, formData: FormData) => issueCreditNote(invoiceId, prevState, formData),
    null,
  );

  const [pendingPayment, setPendingPayment] = useState<FormData | null>(null);
  const [pendingCreditNote, setPendingCreditNote] = useState<FormData | null>(null);
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);

  function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingPayment(new FormData(event.currentTarget));
  }

  function handleCreditNoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingCreditNote(new FormData(event.currentTarget));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <form onSubmit={handlePaymentSubmit} className="flex items-center justify-end gap-2">
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0.01"
          defaultValue={outstandingNaira}
          className="w-24 rounded-control border border-border bg-surface px-2 py-1 text-right text-[12px] text-ink outline-none focus:border-primary"
        />
        <button type="submit" className="text-[12px] font-bold text-primary">
          Record payment
        </button>
      </form>

      <button
        type="button"
        onClick={() => setShowCreditNoteForm((v) => !v)}
        className="text-[12px] font-bold text-bad"
      >
        {showCreditNoteForm ? "Cancel credit note" : "Issue credit note"}
      </button>

      {showCreditNoteForm && (
        <form onSubmit={handleCreditNoteSubmit} className="flex flex-col items-end gap-1.5">
          <input
            type="number"
            name="amount"
            step="0.01"
            min="0.01"
            defaultValue={outstandingNaira}
            placeholder="Amount"
            className="w-24 rounded-control border border-border bg-surface px-2 py-1 text-right text-[12px] text-ink outline-none focus:border-primary"
          />
          <input
            type="text"
            name="reason"
            placeholder="Reason"
            className="w-40 rounded-control border border-border bg-surface px-2 py-1 text-[12px] text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="text-[12px] font-bold text-bad">
            Submit credit note
          </button>
        </form>
      )}

      <FormError message={paymentState?.error ?? creditNoteState?.error} />

      {pendingPayment && (
        <ConfirmDialog
          title="Record this payment?"
          message={`${customerName} paying ₦${pendingPayment.get("amount")} toward "${invoiceDescription}" — this debits Cash & Bank and credits Accounts Receivable.`}
          confirmLabel="Record payment"
          tone="primary"
          onConfirm={() => {
            const formData = pendingPayment;
            setPendingPayment(null);
            paymentAction(formData);
          }}
          onCancel={() => setPendingPayment(null)}
        />
      )}

      {pendingCreditNote && (
        <ConfirmDialog
          title="Issue this credit note?"
          message={`₦${pendingCreditNote.get("amount")} will be written off "${invoiceDescription}" for ${customerName}, reducing Accounts Receivable and reversing that much revenue. This can't be undone.`}
          confirmLabel="Issue credit note"
          onConfirm={() => {
            const formData = pendingCreditNote;
            setPendingCreditNote(null);
            creditNoteAction(formData);
          }}
          onCancel={() => setPendingCreditNote(null)}
        />
      )}
    </div>
  );
}
