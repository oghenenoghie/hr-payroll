"use client";

import { useFormStatus } from "react-dom";

// Drop-in replacement for a bare `<button type="submit">` inside an
// existing `<form action={...}>` — no change needed to the form or its
// action prop, since useFormStatus reads the pending state of whichever
// form this button is rendered inside. For actions that don't need a
// confirmation dialog (see ConfirmActionButton for the ones that do).
export function FormSubmitButton({
  children,
  pendingChildren = "Working…",
  className,
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`disabled:opacity-50 ${className ?? ""}`}>
      {pending ? pendingChildren : children}
    </button>
  );
}
