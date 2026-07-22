"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createPayRun } from "@/app/(app)/payroll-runs/actions";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function CreatePayRunForm() {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [frequency, setFrequency] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBlocked(null);
    setPending(true);

    const result = await createPayRun({ periodStart, periodEnd, frequency });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setBlocked(result.blockedEmployees ?? null);
      return;
    }
    router.push(`/payroll-runs/${result.payRunId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-micro block mb-1.5">Period start</span>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="label-micro block mb-1.5">Period end</span>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-micro block mb-1.5">Frequency</span>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as "monthly" | "biweekly" | "weekly")}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          <option value="monthly">Monthly</option>
          <option value="biweekly">Biweekly</option>
          <option value="weekly">Weekly</option>
        </select>
      </label>

      {error ? (
        <div className="rounded-lg bg-[var(--bad-tint)] text-[var(--bad)] text-xs font-bold px-3 py-2">
          <p>{error}</p>
          {blocked && blocked.length > 0 ? (
            <ul className="list-disc list-inside mt-1">
              {blocked.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
      >
        {pending ? "Running payroll…" : "Run payroll"}
      </button>
    </form>
  );
}
