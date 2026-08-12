// A vertical sequence of dated steps — a request's lifecycle, an approval
// trail, a record's audit history. Shared shape so every "what happened,
// in order" section in the app looks the same rather than each page
// hand-rolling its own stack of bordered rows.
export function Timeline({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

export function TimelineStep({
  label,
  detail,
  tone = "neutral",
}: {
  label: string;
  detail: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const dotClass = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-ink-soft";
  return (
    <div className="flex items-start gap-3 rounded-panel border border-border bg-bg px-3 py-2.5">
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold text-ink">{label}</span>
        <span className="text-[11px] text-ink-soft">{detail}</span>
      </div>
    </div>
  );
}
