"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// A side panel for "add/create without leaving the page" — the same
// shape ConfirmDialog already established (portal to body, backdrop
// click + Escape to dismiss) but a slide-over from the right instead of
// a centered modal, sized for a form rather than a confirm/cancel choice.
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-border bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-extrabold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-control border border-border px-2.5 py-1 text-[13px] font-bold text-ink-soft"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
