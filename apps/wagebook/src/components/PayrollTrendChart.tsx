import { formatKobo } from "@/lib/format";

type TrendPoint = { label: string; netKobo: bigint };

const CHART_HEIGHT = 40;
const BAR_GAP = 4;
const MIN_BAR_HEIGHT = 2;

/** A small bar-series sparkline of net pay across recent pay runs — single
 * hue (no categorical palette needed, this is one series), thin bars,
 * native per-bar tooltips. Server-renderable: plain SVG, no client-side
 * interaction beyond the browser's own title-attribute hover. */
export function PayrollTrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return null;

  const maxKobo = points.reduce((max, p) => (p.netKobo > max ? p.netKobo : max), 0n);
  const barWidth = 100 / points.length - BAR_GAP / 10;

  return (
    <div className="mt-3 flex flex-col gap-1">
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-10 w-full"
        role="img"
        aria-label={`Net pay trend across the last ${points.length} pay runs`}
      >
        {points.map((point, i) => {
          const heightPct = maxKobo > 0n ? Number((point.netKobo * 1000n) / maxKobo) / 10 : 0;
          const barHeight = Math.max(MIN_BAR_HEIGHT, (heightPct / 100) * CHART_HEIGHT);
          const x = i * (100 / points.length) + BAR_GAP / 20;
          const isLatest = i === points.length - 1;
          return (
            <rect
              key={i}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(barWidth, 1)}
              height={barHeight}
              rx="1"
              className={isLatest ? "fill-primary" : "fill-primary-tint"}
            >
              <title>{`${point.label}: ${formatKobo(point.netKobo)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[10.5px] text-ink-soft">
        <span>{points[0]!.label}</span>
        <span>{points[points.length - 1]!.label}</span>
      </div>
    </div>
  );
}
