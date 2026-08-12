import { formatKobo } from "@/lib/format";

// Pure SVG, server-renderable (no client JS, no charting library — see
// engineering-and-lifecycle.md on not introducing a new dependency for
// this). A magnitude-over-time sparkline for one series never needs a
// legend or a second hue: a single fill color plus each bar's own
// <title> tooltip (native, no hover JS required) is the whole
// encoding — see the dataviz skill's color-formula (sequential = one
// hue) and interaction guidance (a bare single-series magnitude strip
// can skip the full crosshair+tooltip treatment a multi-series chart
// needs).
export function PayrollTrendChart({ points }: { points: { label: string; netKobo: bigint }[] }) {
  if (points.length === 0) return null;

  const maxKobo = points.reduce((max, point) => (point.netKobo > max ? point.netKobo : max), 1n);
  const barWidth = 9;
  const gap = 4;
  const height = 40;
  const width = points.length * barWidth + (points.length - 1) * gap;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className="mt-3"
      role="img"
      aria-label="Net pay across recent pay runs"
    >
      {points.map((point, i) => {
        const barHeight = Math.max(2, Number((point.netKobo * BigInt(height)) / maxKobo));
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect key={i} x={x} y={y} width={barWidth} height={barHeight} rx={2} className="fill-primary">
            <title>{`${point.label}: ${formatKobo(point.netKobo)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
