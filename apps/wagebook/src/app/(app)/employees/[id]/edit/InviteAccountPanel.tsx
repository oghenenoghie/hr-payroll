"use client";

import { useActionState } from "react";
import { FormError, FormField, FormNotice, SubmitButton } from "@/components/AuthCard";
import { Badge } from "@/components/Badge";
import { inviteEmployeeAccount, type InviteState } from "./actions";

export function InviteAccountPanel({
  employeeId,
  email,
  linkedAt,
}: {
  employeeId: string;
  email: string | null;
  linkedAt: string | null;
}) {
  const [state, formAction] = useActionState(
    (prevState: InviteState, formData: FormData) => inviteEmployeeAccount(employeeId, prevState, formData),
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employee account</span>

      {linkedAt ? (
        <div className="flex items-center gap-2">
          <Badge tone="good">Linked</Badge>
          <span className="text-[12.5px] text-ink-soft">
            {email} · since {new Date(linkedAt).toLocaleDateString("en-NG")}
          </span>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <FormError message={state?.error} />
          <FormNotice message={state?.success ? "Invite sent." : undefined} />
          {email ? (
            <p className="text-[13px] font-bold text-ink">{email}</p>
          ) : (
            <FormField label="Email" name="email" type="email" />
          )}
          <SubmitButton>{email ? "Send invite" : "Save & send invite"}</SubmitButton>
        </form>
      )}
    </div>
  );
}
