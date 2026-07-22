"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const PAY_FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [companyTin, setCompanyTin] = useState("");
  const [payFrequency, setPayFrequency] = useState<(typeof PAY_FREQUENCIES)[number]>("monthly");
  const [states, setStates] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.rpc("create_organization", {
      p_name: name,
      p_rc_number: rcNumber || undefined,
      p_company_tin: companyTin || undefined,
      p_default_pay_frequency: payFrequency,
      p_default_pfa: undefined,
      p_states_of_operation: states
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="label-micro block mb-1.5">Organization name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="label-micro block mb-1.5">RC number</span>
          <input
            type="text"
            value={rcNumber}
            onChange={(e) => setRcNumber(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="label-micro block mb-1.5">Company TIN</span>
          <input
            type="text"
            value={companyTin}
            onChange={(e) => setCompanyTin(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-micro block mb-1.5">Default pay frequency</span>
        <select
          value={payFrequency}
          onChange={(e) => setPayFrequency(e.target.value as (typeof PAY_FREQUENCIES)[number])}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          {PAY_FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {freq}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label-micro block mb-1.5">States of operation</span>
        <input
          type="text"
          placeholder="Lagos, Rivers, FCT"
          value={states}
          onChange={(e) => setStates(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <span className="block mt-1 text-xs text-[var(--ink-soft)]">Comma-separated.</span>
      </label>

      {error ? (
        <div className="rounded-lg bg-[var(--bad-tint)] text-[var(--bad)] text-xs font-bold px-3 py-2">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
