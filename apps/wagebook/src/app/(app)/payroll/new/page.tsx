import { PayRunForm } from "./PayRunForm";

export default function NewPayRunPage() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Runs</span>
        <h1 className="text-[22px] font-extrabold text-ink">Run payroll</h1>
        <p className="text-[13px] text-ink-soft">
          Computes each active employee&apos;s payslip from the compliance engine and posts a balanced ledger entry.
        </p>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <PayRunForm />
      </div>
    </div>
  );
}
