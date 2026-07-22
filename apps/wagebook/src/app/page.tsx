import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="card max-w-md w-full text-center">
        <p className="label-micro mb-2">Plutus Technologies</p>
        <h1 className="text-2xl font-extrabold mb-3">
          Payroll, correct by construction
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mb-6">
          The compliance engine is live. Try the first shippable slice: verifiable
          PAYE arithmetic under the Nigeria Tax Act 2025 framework.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/paye-calculator"
            className="inline-block rounded-lg bg-[var(--primary)] text-[var(--surface)] px-5 py-2.5 text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors"
          >
            Open PAYE Calculator
          </Link>
          <Link
            href="/login"
            className="inline-block rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--bg)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
