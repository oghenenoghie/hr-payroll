"use client";

import { useActionState } from "react";
import { FormError, FormField, SubmitButton } from "@/components/AuthCard";
import { verifyMfaEnrollment } from "./actions";

export function MfaSetupForm({
  factorId,
  qrCodeDataUri,
  secret,
}: {
  factorId: string;
  qrCodeDataUri: string;
  secret: string;
}) {
  const verifyWithFactor = verifyMfaEnrollment.bind(null, factorId);
  const [state, formAction] = useActionState(verifyWithFactor, null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center rounded-panel border border-border bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG from Supabase, not a static asset */}
        <img
          src={qrCodeDataUri}
          alt="Scan this QR code with your authenticator app"
          className="h-[180px] w-[180px]"
        />
      </div>
      <p className="text-center text-[12px] text-ink-soft">
        Can&apos;t scan? Enter this code manually: <span className="font-bold text-ink">{secret}</span>
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <FormError message={state?.error} />
        <FormField label="6-digit code" name="code" />
        <SubmitButton>Verify and enable</SubmitButton>
      </form>
    </div>
  );
}
