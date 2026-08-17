"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";

type Toast = { id: number; message: string; tone: "neutral" | "good" | "bad" };
type ToastContextValue = { showToast: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 4000;

// Mounted once at the app shell — every Server Action-driven mutation
// that used to have no feedback beyond the page re-rendering can now call
// useToast().showToast("Bill approved") after its transition resolves.
// Deliberately not tied to routing/revalidation itself: a toast is purely
// "that just happened," the page's own re-fetched data is still the
// source of truth for what's now true.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "neutral") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto flex items-center gap-2 rounded-button border px-4 py-2.5 text-[13px] font-bold ${
                  toast.tone === "good"
                    ? "border-good bg-good-tint text-good"
                    : toast.tone === "bad"
                      ? "border-bad bg-bad-tint text-bad"
                      : "border-border bg-surface text-ink"
                }`}
              >
                {toast.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
