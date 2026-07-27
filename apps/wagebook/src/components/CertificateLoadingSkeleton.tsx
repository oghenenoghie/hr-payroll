// Certificates are generated on demand from live payroll records (never a
// stored/stale copy), so the click-to-render gap is real, not instant —
// this is the loading.tsx fallback for all four certificate routes
// (employee/self-service × employment/tax) so a click always shows
// something moving instead of looking unresponsive.
export function CertificateLoadingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] animate-pulse flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-border" />
        <div className="h-9 w-36 rounded-button bg-border" />
      </div>
      <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-8">
        <div className="h-3 w-40 rounded bg-border" />
        <div className="h-6 w-64 rounded bg-border" />
        <div className="mt-2 flex flex-col gap-3">
          <div className="h-3 w-full rounded bg-border" />
          <div className="h-3 w-5/6 rounded bg-border" />
          <div className="h-3 w-2/3 rounded bg-border" />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-3 w-full rounded bg-border" />
          <div className="h-3 w-4/5 rounded bg-border" />
        </div>
      </div>
    </div>
  );
}
