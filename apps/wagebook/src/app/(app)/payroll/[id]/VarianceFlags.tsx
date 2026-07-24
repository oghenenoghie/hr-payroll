import { formatKobo } from "@/lib/format";

export type VarianceFlag = {
  employeeId: string;
  fullName: string;
  priorGrossKobo: bigint;
  currentGrossKobo: bigint;
  changePercent: number;
};

export function VarianceFlags({ flags }: { flags: VarianceFlag[] }) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <div className="rounded-card border border-warn bg-warn-tint p-6">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-warn">
        {flags.length} pay variance flag{flags.length === 1 ? "" : "s"} — worth a second look
      </span>
      <p className="mt-1 text-[12.5px] text-ink-soft">
        Gross pay moved by 25% or more from each employee&apos;s most recent {""}
        run of this same frequency. Not a block on this run — it&apos;s already posted — just a prompt to check for a
        fat-fingered amount before it&apos;s treated as correct. Reverse the run if something here is actually wrong.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {flags.map((flag) => (
          <div key={flag.employeeId} className="flex items-baseline justify-between border-b border-border py-[8px] last:border-b-0">
            <span className="text-[13px] font-bold text-ink">{flag.fullName}</span>
            <span className="text-[13px] text-ink-soft">
              {formatKobo(flag.priorGrossKobo)} → {formatKobo(flag.currentGrossKobo)}{" "}
              <span className="font-bold text-warn">
                ({flag.changePercent > 0 ? "+" : ""}
                {flag.changePercent.toFixed(0)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
