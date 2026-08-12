"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toCsv } from "@/lib/csv";
import { createLoginsForAllEmployees, type BulkCreateLoginsResult } from "./actions";

export function BulkCreateLoginsPanel({ unlinkedCount }: { unlinkedCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkCreateLoginsResult | null>(null);

  function run() {
    setConfirming(false);
    startTransition(async () => {
      setResult(await createLoginsForAllEmployees());
    });
  }

  function downloadCsv() {
    if (!result?.created?.length) return;
    const csv = toCsv(
      ["Name", "Sign in with", "Password"],
      result.created.map((c) => [c.fullName, c.loginIdentifier, c.password]),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-logins.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (unlinkedCount === 0 && !result) return null;

  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Bulk create logins</span>

      {!result && (
        <>
          <p className="mt-2 text-[13px] text-ink-soft">
            {unlinkedCount} employee{unlinkedCount === 1 ? "" : "s"} without a login yet. Generate one for every one
            of them at once, using their email if on file or their Employee ID otherwise.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white disabled:opacity-60"
          >
            {pending ? "Creating logins…" : `Create logins for all ${unlinkedCount}`}
          </button>
        </>
      )}

      {confirming && (
        <ConfirmDialog
          title="Create logins for all employees?"
          message={`This creates a real login and password for ${unlinkedCount} employee${unlinkedCount === 1 ? "" : "s"} right now. You'll need to copy and hand out each password afterward — it won't be shown again.`}
          confirmLabel="Create logins"
          tone="primary"
          onConfirm={run}
          onCancel={() => setConfirming(false)}
        />
      )}

      {result?.error && <p className="mt-3 text-[13px] font-bold text-bad">{result.error}</p>}

      {result && (result.created?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-panel border border-good bg-good-tint px-3 py-2 text-[12.5px] font-bold text-good">
            Created {result.created!.length} login{result.created!.length === 1 ? "" : "s"}. Copy these credentials
            now and send them to each person — the passwords won&apos;t be shown again.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Sign in with</th>
                  <th className="py-2">Password</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {result.created!.map((c, index) => (
                  <tr key={index} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-3 font-sans font-bold text-ink">{c.fullName}</td>
                    <td className="py-2 pr-3 text-ink">{c.loginIdentifier}</td>
                    <td className="py-2 text-ink">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            className="w-fit rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
          >
            Download CSV
          </button>
        </div>
      )}

      {result && (result.skipped?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Skipped ({result.skipped!.length})
          </span>
          {result.skipped!.map((s, index) => (
            <div key={index} className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-ink">{s.fullName}</span>
              <span className="text-ink-soft">{s.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
