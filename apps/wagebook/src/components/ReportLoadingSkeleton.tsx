// Shared loading.tsx fallback for the report-style pages whose entire
// content depends on one or more aggregate queries (trial balance, payroll
// totals, financial statement sums) — there's nothing meaningful to paint
// until that data resolves, so a full skeleton is the honest fallback
// rather than a half-rendered shell. Matches CertificateLoadingSkeleton's
// same visual language (animate-pulse + bg-border blocks) for consistency.
const MAX_WIDTH_CLASS = {
  "720": "max-w-[720px]",
  "960": "max-w-[960px]",
  "1100": "max-w-[1100px]",
} as const;

export function ReportLoadingSkeleton({ maxWidth = "960" }: { maxWidth?: keyof typeof MAX_WIDTH_CLASS }) {
  return (
    <div className={`mx-auto flex w-full ${MAX_WIDTH_CLASS[maxWidth]} animate-pulse flex-col gap-5 px-6 py-10`}>
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-6 w-72 rounded bg-border" />
        <div className="h-3 w-full max-w-[480px] rounded bg-border" />
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-border" />
        ))}
      </div>
    </div>
  );
}
