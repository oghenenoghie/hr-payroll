"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/AuthCard";
import { processFinalSettlement, type ProcessSettlementState } from "./actions";

export function SettleForm({ employeeId }: { employeeId: string }) {
  const [state, formAction] = useActionState(
    (prevState: ProcessSettlementState, formData: FormData) => processFinalSettlement(employeeId, prevState, formData),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state?.error} />
      <SubmitButton>Process final settlement</SubmitButton>
    </form>
  );
}
