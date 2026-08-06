import { formatKobo } from "@/lib/format";
import type { Kobo } from "@plutus/compliance";

export function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-surface p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <span className="text-[24px] font-extrabold text-ink">{value}</span>
      <span className="text-[11px] text-ink-soft">{caption}</span>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-primary-tint text-[11px] font-extrabold uppercase tracking-[0.03em] text-primary-dark">
      {initials}
    </div>
  );
}

const DONUT_SEGMENTS: { key: "approved" | "pending" | "rejected"; label: string; colorVar: string }[] = [
  { key: "approved", label: "Approved", colorVar: "var(--good)" },
  { key: "pending", label: "Pending", colorVar: "var(--warn)" },
  { key: "rejected", label: "Rejected", colorVar: "var(--bad)" },
];

export function ApprovalDonut({
  approved,
  pending,
  rejected,
}: {
  approved: number;
  pending: number;
  rejected: number;
}) {
  const total = approved + pending + rejected;
  const counts = { approved, pending, rejected };

  let cursor = 0;
  const stops = DONUT_SEGMENTS.map((segment) => {
    const share = total > 0 ? (counts[segment.key] / total) * 100 : 0;
    const start = cursor;
    cursor += share;
    return `${segment.colorVar} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-[112px] w-[112px] shrink-0 rounded-full"
        style={{ background: total > 0 ? `conic-gradient(${stops})` : "var(--border)" }}
        role="img"
        aria-label={`${approved} approved, ${pending} pending, ${rejected} rejected`}
      >
        <div className="absolute inset-[16px] flex flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-[19px] font-extrabold text-ink">{total}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.03em] text-ink-soft">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {DONUT_SEGMENTS.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.colorVar }} aria-hidden="true" />
            <span className="text-ink-soft">{segment.label}</span>
            <span className="font-bold text-ink">{counts[segment.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyPayrollCostChart({ months }: { months: { label: string; totalKobo: Kobo }[] }) {
  const maxKobo = months.reduce((max, m) => (m.totalKobo > max ? m.totalKobo : max), 1n);

  return (
    <div className="flex items-end gap-3 pt-4" style={{ height: 168 }}>
      {months.map((month) => {
        const heightPct = maxKobo > 0n ? Number((month.totalKobo * 1000n) / maxKobo) / 10 : 0;
        return (
          <div key={month.label} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div
              role="img"
              aria-label={`${month.label}: ${formatKobo(month.totalKobo)}`}
              className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-panel border border-border bg-surface px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100"
            >
              {formatKobo(month.totalKobo)}
            </div>
            <div
              className="w-full max-w-[28px] rounded-t-[4px] bg-primary-tint transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(heightPct, month.totalKobo > 0n ? 3 : 1)}%` }}
            />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.02em] text-ink-soft">{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DeadlineItem({ dateLabel, title, authority }: { dateLabel: string; title: string; authority: string }) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-border bg-bg px-3 py-2.5">
      <div className="flex w-11 shrink-0 flex-col items-center rounded-control border border-border bg-surface py-1.5">
        <span className="text-[13px] font-extrabold text-ink">{dateLabel}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        <span className="text-[11px] text-ink-soft">{authority}</span>
      </div>
    </div>
  );
}
