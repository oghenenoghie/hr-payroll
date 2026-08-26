import { Button } from "@/components/Button";

// Scoped to the (app) route group so it renders inside AppShell (sidebar,
// top bar) instead of falling through to the root app/not-found.tsx, which
// is styled for the signed-out AuthCard shell — without this, a signed-in
// user hitting a stale link (e.g. a deleted employee, an old bookmark) or
// any notFound() call from inside (app)/* would look like they'd been
// logged out. Root not-found.tsx still handles a URL that doesn't match
// any route at all, since route groups carry no URL segment of their own.
export default function AppNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 px-6 py-20 text-center">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">404</span>
      <h1 className="text-[22px] font-extrabold text-ink">Page not found</h1>
      <p className="text-[13px] text-ink-soft">
        This page doesn&apos;t exist or may have moved — the record it pointed to may also have been deleted.
      </p>
      <Button href="/dashboard" size="md">
        Back to dashboard
      </Button>
    </div>
  );
}
