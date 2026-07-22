import { redirect } from "next/navigation";
import { NG_2026_1 } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { formatKobo } from "@/lib/format";
import { getMembership } from "@/lib/membership";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const SCHEME_ACCOUNT_CODES = {
  paye: "paye_payable",
  pension: "pension_payable",
  nhf: "nhf_payable",
  nsitf: "nsitf_payable",
} as const;

const SCHEME_LABEL: Record<keyof typeof SCHEME_ACCOUNT_CODES, string> = {
  paye: "PAYE",
  pension: "Pension",
  nhf: "NHF",
  nsitf: "NSITF",
};

function describeDeadline(scheme: keyof typeof SCHEME_ACCOUNT_CODES, rv: typeof NG_2026_1): string {
  switch (scheme) {
    case "paye":
      return `${rv.paye.remittance.dueDayOfFollowingMonth}th of the following month · ${rv.paye.remittance.authority.replace("_", " ")}`;
    case "pension":
      return `Within ${rv.pension.remittance.dueWorkingDaysAfterPayment} working days of payment · ${rv.pension.remittance.authority}`;
    case "nhf":
      return `Within ${rv.nhf.remittance.dueMonthsAfterPayment} month of payment · ${rv.nhf.remittance.authority}`;
    case "nsitf":
      return `Before the ${rv.nsitf.remittance.dueDayOfFollowingMonth}th of the following month · ${rv.nsitf.remittance.authority}`;
  }
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { data: postings } = await supabase
    .from("ledger_postings")
    .select("account_code, amount_kobo")
    .eq("direction", "credit")
    .in("account_code", Object.values(SCHEME_ACCOUNT_CODES));

  const totalsByAccountCode = new Map<string, bigint>();
  for (const posting of postings ?? []) {
    const running = totalsByAccountCode.get(posting.account_code) ?? 0n;
    totalsByAccountCode.set(posting.account_code, running + BigInt(posting.amount_kobo));
  }

  const { data: payslips } = await supabase.from("payslips").select("paye_kobo, employees(state_of_residence)");

  const payeByState = new Map<string, bigint>();
  for (const slip of payslips ?? []) {
    const state = slip.employees?.state_of_residence ?? "Unspecified";
    const running = payeByState.get(state) ?? 0n;
    payeByState.set(state, running + BigInt(slip.paye_kobo));
  }
  const stateRows = [...payeByState.entries()]
    .filter(([, amount]) => amount > 0n)
    .sort((a, b) => Number(b[1] - a[1]));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Reports</span>
        <h1 className="text-[22px] font-extrabold text-ink">Statutory liabilities and audit-ready records by state</h1>
        <p className="text-[13px] text-ink-soft">
          Totals posted across every pay run to date. Remittance/filing-status tracking isn&apos;t built yet — these
          are liability totals, not a claim about what has actually been paid to each authority.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Scheme</th>
              <th className={`${thClass} text-right`}>Liability posted to date</th>
              <th className={`${thClass} text-left`}>Deadline · authority</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(SCHEME_ACCOUNT_CODES) as (keyof typeof SCHEME_ACCOUNT_CODES)[]).map((scheme) => {
              const amount = totalsByAccountCode.get(SCHEME_ACCOUNT_CODES[scheme]) ?? 0n;
              return (
                <tr key={scheme} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{SCHEME_LABEL[scheme]}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(amount)}</td>
                  <td className={`${tdClass} text-ink-soft`}>{describeDeadline(scheme, NG_2026_1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 pt-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          PAYE liability by state of residence
        </span>
        <p className="text-[12.5px] text-ink-soft">
          PAYE is collected by each employee&apos;s state of residence, not the employer&apos;s location — a
          multi-state workforce means reconciling with multiple state IRS offices every cycle.
        </p>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>State</th>
              <th className={`${thClass} text-right`}>PAYE liability posted to date</th>
            </tr>
          </thead>
          <tbody>
            {stateRows.length > 0 ? (
              stateRows.map(([state, amount]) => (
                <tr key={state} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{state}</td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No PAYE liability posted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
