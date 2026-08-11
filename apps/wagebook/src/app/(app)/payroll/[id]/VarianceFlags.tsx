export type VarianceFlagRow = {
  id: string;
  flag_type: string;
  detail: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

const FLAG_TONE: Record<string, string> = {
  gross_spike: "warn",
  gross_drop: "warn",
  employee_missing: "bad",
};

export function VarianceFlags({ flags, payRunStatus }: { flags: VarianceFlagRow[]; payRunStatus: string }) {
  if (flags.length === 0) {
    return null;
  }

  const unacknowledgedCount = flags.filter((f) => !f.acknowledged_by).length;

  return (
    <div className="rounded-card border border-warn bg-warn-tint p-6">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-warn">
        {flags.length} pay variance flag{flags.length === 1 ? "" : "s"} — worth a second look
      </span>
      <p className="mt-1 text-[12.5px] text-ink-soft">
        {payRunStatus === "draft"
          ? unacknowledgedCount > 0
            ? "This run can't be approved until these are reviewed — approve again once you've checked them to acknowledge and proceed."
            : "Reviewed — this run can now be approved."
          : "Not a block on this run — it's already posted — just a prompt to check for a fat-fingered amount before it's treated as correct. Reverse the run if something here is actually wrong."}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {flags.map((flag) => (
          <div
            key={flag.id}
            className="flex items-baseline justify-between gap-3 border-b border-border py-[8px] last:border-b-0"
          >
            <span className={`text-[13px] ${FLAG_TONE[flag.flag_type] === "bad" ? "font-bold text-bad" : "text-ink"}`}>
              {flag.detail}
            </span>
            {flag.acknowledged_by && <span className="whitespace-nowrap text-[11px] text-ink-soft">Reviewed</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
