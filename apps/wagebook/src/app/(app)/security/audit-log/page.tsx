import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { Badge } from "@/components/Badge";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function formatWhen(createdAt: string) {
  try {
    return new Date(createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return createdAt;
  }
}

export default async function AuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: entries, error } = await supabase.rpc("get_org_audit_log", {
    p_org_id: membership.orgId,
  });

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/security" className="text-[12px] font-bold text-primary">
          ← Security &amp; Access
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Audit Log</span>
        <h1 className="text-[22px] font-extrabold text-ink">Authentication events for your organisation</h1>
        <p className="text-[13px] text-ink-soft">
          Sign-ins, sign-ups and other account events for members of your org, sourced directly from Supabase
          Auth&apos;s audit trail. Shows the most recent 200 events.
        </p>
      </header>

      {error && (
        <div className="rounded-panel border border-bad bg-bad-tint px-4 py-3 text-[12.5px] font-bold text-bad">
          Could not load the audit log: {error.message}
        </div>
      )}

      {!error && (entries ?? []).length === 0 && (
        <div className="rounded-card border border-border bg-surface px-4 py-6 text-center text-[13px] text-ink-soft">
          No audit events recorded yet.
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
    </div>
  );
}
