"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

// Drop-in replacement for a bare `<button type="submit">` inside an
// existing `<form action={...}>` — no change needed to the form or its
// action prop, since useFormStatus reads the pending state of whichever
// form this button is rendered inside. For actions that don't need a
// confirmation dialog (see ConfirmActionButton for the ones that do).
//
// variant/size come from the shared Button spec (see
// .claude/skills/plutus-button-nav-system/SKILL.md) instead of a
// className — defaults to "row" since this component's overwhelming
// use is a small in-context submit ("Match", "Save", "Mark read")
// rather than a page-level primary action.
//
// className stays as an escape hatch for the rare non-Button control
// this wraps (e.g. AttendanceGrid's per-cell status chip, which is a
// dynamically-colored data control, not one of the five button
// variants) — pass it and it fully replaces variant/size, same as
// before this spec existed. Every other call site should use
// variant/size instead.
export function FormSubmitButton({
  children,
  pendingChildren = "Working…",
  variant = "row",
  size = "row",
  fullWidth,
  className,
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? buttonClasses(variant, size, fullWidth)}
    >
      {pending ? pendingChildren : children}
    </button>
  );
}
