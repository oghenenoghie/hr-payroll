"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

function nairaToKobo(naira: string): number {
  const n = Number(naira);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function AddEmployeeForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [stateOfResidence, setStateOfResidence] = useState("");
  const [basic, setBasic] = useState("");
  const [housing, setHousing] = useState("");
  const [transport, setTransport] = useState("");
  const [annualRent, setAnnualRent] = useState("");
  const [tin, setTin] = useState("");
  const [pfa, setPfa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.from("employees").insert({
      org_id: orgId,
      full_name: fullName,
      state_of_residence: stateOfResidence || null,
      basic_kobo: nairaToKobo(basic),
      housing_kobo: nairaToKobo(housing),
      transport_kobo: nairaToKobo(transport),
      annual_rent_kobo: nairaToKobo(annualRent),
      tin: tin || null,
      pfa: pfa || null,
    });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/employees");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="label-micro block mb-1.5">Full name</span>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </label>

      <label className="block">
        <span className="label-micro block mb-1.5">State of residence</span>
        <input
          type="text"
          placeholder="Lagos"
          value={stateOfResidence}
          onChange={(e) => setStateOfResidence(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
      </label>

      <p className="label-micro">Monthly pay components (₦)</p>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="label-micro block mb-1.5">Basic</span>
          <input
            type="number"
            min={0}
            required
            value={basic}
            onChange={(e) => setBasic(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="label-micro block mb-1.5">Housing</span>
          <input
            type="number"
            min={0}
            value={housing}
            onChange={(e) => setHousing(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="label-micro block mb-1.5">Transport</span>
          <input
            type="number"
            min={0}
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-micro block mb-1.5">Annual rent paid (₦)</span>
        <input
          type="number"
          min={0}
          value={annualRent}
          onChange={(e) => setAnnualRent(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <span className="block mt-1 text-xs text-[var(--ink-soft)]">Used for rent relief in PAYE.</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-micro block mb-1.5">Tax Identification Number</span>
          <input
            type="text"
            value={tin}
            onChange={(e) => setTin(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
        <label className="block">
          <span className="label-micro block mb-1.5">PFA</span>
          <input
            type="text"
            value={pfa}
            onChange={(e) => setPfa(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </label>
      </div>

      {!tin ? (
        <div className="rounded-lg bg-[var(--warn-tint)] text-[var(--warn)] text-xs font-bold px-3 py-2">
          No TIN — this employee will block a payroll run until one is added.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg bg-[var(--bad-tint)] text-[var(--bad)] text-xs font-bold px-3 py-2">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add employee"}
      </button>
    </form>
  );
}
