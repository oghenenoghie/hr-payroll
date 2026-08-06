import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 100;

function formatWhen(createdAt: string) {
  try {
    return new Date(createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return createdAt;
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    membership?.role !== "admin" &&
    membership?.role !== "auditor" &&
    membership?.role !== "finance_manager" &&
    membership?.role !== "legal_compliance"
  ) {
    redirect("/dashboard");
  }

  const { before } = await searchParams;

  // Cursor-based, not page-numbered: auth.audit_log_entries is a single
  // unbounded log shared by every org on this Supabase project, so an
  // exact total count for "page 3 of 40" would itself be an expensive
  // full scan on every visit. "before" — the oldest event already shown
  // — asks Postgres for the next batch strictly older than that, one
  // indexed range scan, no count needed.
  const { data: entries, error } = await supabase.rpc("get_org_audit_log", {
    p_org_id: membership.orgId,
    p_limit: PAGE_SIZE,
    p_before: before ?? undefined,
  });

  const oldestEntry = entries && entries.length > 0 ? entries[entries.length - 1] : null;
  const hasMore = (entries?.length ?? 0) === PAGE_SIZE;

  const csv = toCsv(
    ["When", "Actor", "Action", "Type", "IP Address"],
    (entries ?? []).map((entry) => [
      formatWhen(entry.created_at),
      entry.actor_username ?? entry.actor_id ?? "Unknown",
      entry.action ?? "",
      entry.log_type ?? "",
      entry.ip_address ?? "",
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Link href="/security" className="text-[12px] font-bold text-primary">
            ← Security &amp; Access
          </Link>
          {!error && (entries ?? []).length > 0 && <ExportCsvButton csv={csv} filename="audit-log.csv" label="Export this page (CSV)" />}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Audit Log</span>
        <h1 className="text-[22px] font-extrabold text-ink">Authentication events for your organisation</h1>
        <p className="text-[13px] text-ink-soft">
          Sign-ins, sign-ups and other account events for members of your org, sourced directly from Supabase
          Auth&apos;s audit trail. {PAGE_SIZE} events per page, newest first — use &quot;Older events&quot; below to
          page back through history.
        </p>
        {before && (
          <Link href="/security/audit-log" className="mt-1 w-fit text-[12.5px] font-bold text-primary">
            ← Back to latest
          </Link>
        )}
      </header>

      {error && (
        <div className="rounded-panel border border-bad bg-bad-tint px-4 py-3 text-[12.5px] font-bold text-bad">
          Could not load the audit log: {error.message}
        </div>
      )}

      {!error && (entries ?? []).length === 0 && (
        <div className="rounded-card border border-border bg-surface px-4 py-6 text-center text-[13px] text-ink-soft">
          No audit events {before ? "before this point" : "recorded yet"}.
        </div>
      )}

      {!error && (entries ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>When</th>
                <th className={`${thClass} text-left`}>Actor</th>
                <th className={`${thClass} text-left`}>Action</th>
                <th className={`${thClass} text-left`}>Type</th>
                <th className={`${thClass} text-left`}>IP address</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((entry, i) => (
                <tr key={`${entry.created_at}-${i}`} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink-soft`}>{formatWhen(entry.created_at)}</td>
                  <td className={`${tdClass} font-bold text-ink`}>{entry.actor_username ?? entry.actor_id ?? "Unknown"}</td>
                  <td className={tdClass}>
                    {entry.action ? <Badge tone="neutral">{entry.action}</Badge> : <span className="text-ink-soft">—</span>}
                  </td>
                  <td className={`${tdClass} text-ink-soft`}>{entry.log_type ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{entry.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && oldestEntry && (
        <div className="flex justify-end">
          <Link
            href={`/security/audit-log?before=${encodeURIComponent(oldestEntry.created_at)}`}
            className="text-[12.5px] font-bold text-primary"
          >
            Older events →
          </Link>
        </div>
      )}
    </div>
  );
}
