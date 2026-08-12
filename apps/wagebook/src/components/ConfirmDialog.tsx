"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Shared confirmation modal for anything destructive or decision-committing
// (delete, approve/reject, discard, reverse, dispose, disconnect, etc.) —
// rendered via a portal to document.body so it always sits above the app
// shell regardless of where the trigger button lives in the tree.
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  // This component only ever mounts in response to a client-side click
  // (every call site conditionally renders it from state that starts
  // false), never as part of the initial server-rendered HTML — so
  // `document` is always available by the time this actually runs, with
  // no SSR/hydration mismatch to guard against.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] rounded-card border border-border bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-[15px] font-extrabold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[13px] text-ink-soft">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            autoFocus={tone === "danger"}
            className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus={tone !== "danger"}
            className={`rounded-button px-[18px] py-[9px] text-[12.5px] font-extrabold text-white ${
              tone === "danger" ? "bg-bad" : "bg-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
