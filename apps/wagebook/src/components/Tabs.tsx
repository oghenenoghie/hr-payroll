"use client";

import { useState } from "react";

// Content-switching tabs for a page whose sections are alternate views of
// the same subject rather than a sequential scroll (Bills' pending /
// awaiting-payment / settled queues, for example) — each tab's content is
// still rendered server-side and passed in as-is; this only owns which
// one is visible. Not for page-to-page navigation — use plain Links for
// that (see the Workflows admin page's request-type switcher).
export function Tabs({
  tabs,
  defaultTabId,
}: {
  tabs: { id: string; label: string; badge?: number; content: React.ReactNode }[];
  defaultTabId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-bold transition-colors ${
                isActive ? "border-primary text-ink" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {tab.label}
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`rounded-full px-[7px] py-[1px] text-[11px] font-extrabold ${
                    isActive ? "bg-primary-tint text-primary-dark" : "border border-border text-ink-soft"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{active?.content}</div>
    </div>
  );
}
