import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";

type ModuleStatus = "live" | "partial" | "roadmap";

type Module = {
  name: string;
  status: ModuleStatus;
  description: string;
};

// Honestly flagged against what this build actually does — not what the
// product could eventually cover. An inflated feature map is the fastest
// way to lose credibility with a finance buyer who clicks into things.
const MODULES: Module[] = [
  { name: "Employee Management", status: "live", description: "Employee CRUD, TIN/PFA/bank account (NUBAN) capture, self-service account linking via invite, department assignment for cost-centre reporting, job grades with salary bands (the edit page flags an employee whose annual pay falls outside their assigned grade), manager assignment with a company-wide Org Chart view (cycle-safe — a manager loop can't be created or rendered), date of birth / nationality capture, probation end date and a confirmed flag (surfaced as an Overdue/Ends soon/On probation badge in the directory — a company-policy date, not a statutory probation length, since Nigerian law doesn't legislate one), employment type (permanent/contract/intern) and contract end date (surfaced as an Expired/Ends soon/Active contract directory badge — a status check on page load, not a scheduled push alert, since this app has no background job runner), directory search/filter by name/status/department/branch, branch assignment (a work-location record — name, state, address — for cost-centre/location reporting; it does not drive PAYE routing, which stays keyed off each employee's own state of residence), a Suspended status distinct from Active/Terminated (excluded from regular pay runs the same way any non-active status already was, with zero query changes — but unlike Terminated, it doesn't revoke self-service access or trigger Final Settlement eligibility, since both of those stay keyed specifically to the terminated status), an auto-logged status-change history (never client-written) shown per employee, an onboarding checklist for any non-terminated employee (documentation collected, contract signed — probation tracking and confirmation are handled separately by the existing probation fields), and — for a terminated employee — an offboarding checklist (notice period served, assets returned, clearance obtained, experience letter issued) alongside read-only indicators for the two steps that are already automatic (access revocation, final settlement status). Neither checklist generates or e-signs any document — both only track whether a step happened. A per-employee document repository (Supabase Storage-backed, private bucket, admin/HR-uploaded with an optional free-text type label) lets an employee view and download their own files from /me, alongside admin/HR upload and delete from the edit page — generic storage, not a structured document taxonomy or e-signature. DOB isn't yet wired into any pension-age eligibility rule and nationality isn't yet wired into expatriate PAYE treatment — both are open statutory questions this build doesn't guess at. Neither probation status nor employment type is wired into payroll math — pay is computed identically regardless of either." },
  { name: "Payroll Setup", status: "live", description: "Company setup on sign-up: pay frequency, PFA default, states of operation." },
  { name: "Salary Structure", status: "live", description: "Basic / housing / transport pay components per employee." },
  { name: "Earnings Management", status: "partial", description: "Weekly/biweekly/monthly, 13th Month (one month's basic) and discretionary Bonus (admin-entered per employee) frequencies are all real, each taxed on top of year-to-date. Off-cycle exists via Final Settlement specifically. Arrears/retroactive pay is not built — the correct rule-version treatment is a genuinely open tax question, not yet resolved." },
  { name: "Deductions", status: "live", description: "PAYE, pension, NHF, loan repayments and benefit contributions, all itemised per payslip. Deduction priority is explicit and enforced: statutory deductions are never skipped, loans are capped against whatever net pay remains, and a benefit enrollment whose employee cost can't be fully covered by what's left is skipped in its entirety that run (earliest-enrolled first) rather than partially charged — net pay can never go negative, backstopped by a database check constraint." },
  { name: "Attendance Integration", status: "live", description: "Weekly Present/Late/Absent grid; unrecorded absences deduct pay automatically." },
  { name: "Leave Management", status: "live", description: "Leave requests, balances, admin/HR/manager approval, unpaid leave deducts pay. Leave encashment — cashing out unused annual leave for money while still employed, distinct from Final Settlement's termination-only leave payout — is admin/payroll_manager-approved with an atomic balance check (rejects and rolls back cleanly if the employee doesn't have enough days) and pays out taxable, non-pensionable income through the next pay run." },
  { name: "Overtime Management", status: "live", description: "Employee-submitted overtime requests, admin/payroll approval with a 1.5×/2× rate, paid via next pay run as taxable (non-pensionable) pay." },
  { name: "Loans & Advances", status: "live", description: "Employee-initiated requests, admin/payroll approval, automatic net-pay repayment." },
  { name: "Tax Management", status: "live", description: "Cumulative PAYE on the 2026 Nigeria Tax Act bands, re-derived every run. The public PAYE Calculator also solves net-to-gross (gross-up) for a target take-home; gross-up against a real employee's own pay components isn't wired into pay-run creation yet. Annual tax reconciliation (per-employee yearly gross/PAYE/pension/NHF, CSV export) is live, and a printable annual tax certificate can be generated from that same data per employee — admin/HR from the reconciliation report or the employee's own record, self-service from /me. Direct e-filing to NRS/state IRS is not built." },
  { name: "Benefits Administration", status: "live", description: "HR-managed plan catalog and enrollment; employer cost and employee deduction per pay run." },
  { name: "Payroll Processing", status: "partial", description: "Atomic pay-run creation with a balanced double-entry ledger; new-hire pay is prorated to actual days employed this period, and termination mid-period proration is handled by Final Settlement. Admin-only reversal posts a correcting journal entry for a finalised run — it does not restore loan/expense/leave/attendance/overtime side effects or address already-remitted statutory amounts, both flagged as open questions. Mid-period salary-change proration is not built (it needs an effective-dated compensation history model this build doesn't have yet)." },
  { name: "Payslips", status: "live", description: "Itemised digital payslips with a step-by-step \"· how?\" derivation of every figure." },
  { name: "Document Generation", status: "partial", description: "Employment & Salary Certificate — a printable proof-of-employment document with current salary breakdown, generated on demand from live payroll records (never a stored/stale copy). Admin/HR can generate one for any employee (respecting salary masking); every employee can generate their own from /me (their own salary always shows, since masking hides figures from other viewers, not from the employee themselves). Employment letters, contracts, tax documents and e-signature are not built." },
  { name: "Direct Deposit & Payments", status: "roadmap", description: "Employee bank account capture is real and checksum-validated against the CBN's NUBAN check-digit algorithm for a curated list of ~25 major Nigerian banks (an \"Other\" option covers any unlisted institution, enforcing the 10-digit format only). This confirms the account number is internally consistent with the selected bank's own numbering — it does not confirm the account exists or belongs to the named holder, which needs a live bank-verification API this build doesn't call. Integrations shows real coverage. Net pay is posted to the ledger; still no bank disbursement file or transfer integration." },
  { name: "Expense Reimbursement", status: "live", description: "Claims, admin/payroll approval with taxable/non-taxable treatment, paid via next run." },
  { name: "Compliance", status: "live", description: "PAYE, pension, NHF, NHIS, NSITF, ITF and WHT schemes with TIN gating before every run." },
  { name: "Employee Self-Service", status: "live", description: "Payslips, leave, loans, expenses, benefits and notifications in one dashboard." },
  { name: "Manager Self-Service", status: "live", description: "Direct-report roster and leave approval for any employee with reports." },
  { name: "Reporting & Analytics", status: "live", description: "Statutory liability totals, PAYE-by-state breakdowns, and a per-run payroll register with a ledger-balanced reconciliation check for every pay run, including reversals." },
  { name: "Accounting Integration", status: "partial", description: "Real, fully itemised general-ledger CSV export per pay run, with each employee's department attributed as a cost centre. No live accounting-software API sync (QuickBooks, Xero, Sage) yet." },
  { name: "Workflow & Approvals", status: "live", description: "Leave, loan, expense and benefit-enrollment approval flows across admin/HR/payroll/manager roles." },
  { name: "Notifications", status: "live", description: "Requests and decisions notify the right people; unread counts surface in the sidebar and on /me." },
  { name: "Company Policies", status: "live", description: "Admin/HR-authored policy documents with a per-employee acknowledgement tracker. Editing a policy marks every prior acknowledgement stale (a timestamp comparison, not a versioned document history) and every linked employee account is notified to re-acknowledge. Status (Acknowledged / Needs re-acknowledgment / Not acknowledged) is computed on page load, not a scheduled reminder push, since this app has no background job runner." },
  { name: "Security", status: "live", description: "Role-based access (admin/payroll manager/HR manager/employee), mandatory TOTP MFA for admin and payroll manager, an org-scoped authentication audit log, per-employee salary masking from HR Manager view (a real database-level mask, not just a hidden UI field), and offboarding access revocation — a terminated employee's linked login is redirected away from every self-service route the moment their record is marked exited, re-checked live rather than cached, so a reinstated employee isn't stuck behind a stale gate. This covers the specific \"retained login\" security gap only." },
  { name: "Multi-Company & Global Payroll", status: "roadmap", description: "Nigeria only. Ghana (SSNIT) and Kenya (NSSF/SHIF) rule sets are roadmap, not built." },
  { name: "Integrations", status: "partial", description: "Bank disbursement connections are a real per-org toggle, but explicitly a demo — no bank API calls, no disbursement file generation." },
  { name: "Final Settlement", status: "live", description: "Exit payroll: prorated regular pay for the partial final period (pensionable and NHF-able, unlike leave payout and gratuity, which are non-pensionable lump sums — all three are taxed together in one cumulative-PAYE calculation), leave payout, gratuity and full loan clearance in one off-cycle run. The final period's last working day comes from the auto-logged status-change history. Rent relief is not re-prorated for that stub period — a disclosed simplification." },
  { name: "Advanced Features", status: "partial", description: "Payroll Simulation (what-if analysis across the workforce) is live; nothing further built yet." },
];

const STATUS_LABEL: Record<ModuleStatus, string> = { live: "Live", partial: "Partial", roadmap: "Roadmap" };
const STATUS_TONE: Record<ModuleStatus, "good" | "warn" | "neutral"> = { live: "good", partial: "warn", roadmap: "neutral" };

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function FeatureMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const liveCount = MODULES.filter((m) => m.status === "live").length;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Full Feature Map</span>
        <h1 className="text-[22px] font-extrabold text-ink">
          Every payroll &amp; HR capability this platform is built to cover
        </h1>
        <p className="text-[13px] text-ink-soft">
          {liveCount} of {MODULES.length} modules are live in this build today — the rest are honestly flagged
          Roadmap or Partial, not implied as built.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Module</th>
              <th className={`${thClass} text-left`}>What&apos;s here</th>
              <th className={`${thClass} text-center`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module.name} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} font-bold text-ink`}>{module.name}</td>
                <td className={`${tdClass} text-ink-soft`}>{module.description}</td>
                <td className={`${tdClass} text-center`}>
                  <Badge tone={STATUS_TONE[module.status]}>{STATUS_LABEL[module.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
