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
  { name: "Employee Management", status: "live", description: "Employee CRUD, TIN/PFA/bank account (NUBAN) capture, self-service account linking via invite." },
  { name: "Payroll Setup", status: "live", description: "Company setup on sign-up: pay frequency, PFA default, states of operation." },
  { name: "Salary Structure", status: "live", description: "Basic / housing / transport pay components per employee." },
  { name: "Earnings Management", status: "partial", description: "Weekly/biweekly/monthly and 13th Month (one month's basic, taxed on top of year-to-date) frequencies are real. Off-cycle exists via Final Settlement specifically. Discretionary bonus and arrears frequencies are not built — there's no UI for a per-employee one-off amount yet." },
  { name: "Deductions", status: "live", description: "PAYE, pension, NHF, loan repayments and benefit contributions, all itemised per payslip." },
  { name: "Attendance Integration", status: "live", description: "Weekly Present/Late/Absent grid; unrecorded absences deduct pay automatically." },
  { name: "Leave Management", status: "live", description: "Leave requests, balances, admin/HR/manager approval, unpaid leave deducts pay." },
  { name: "Overtime Management", status: "live", description: "Employee-submitted overtime requests, admin/payroll approval with a 1.5×/2× rate, paid via next pay run as taxable (non-pensionable) pay." },
  { name: "Loans & Advances", status: "live", description: "Employee-initiated requests, admin/payroll approval, automatic net-pay repayment." },
  { name: "Tax Management", status: "live", description: "Cumulative PAYE on the 2026 Nigeria Tax Act bands, re-derived every run. The public PAYE Calculator also solves net-to-gross (gross-up) for a target take-home; gross-up against a real employee's own pay components isn't wired into pay-run creation yet." },
  { name: "Benefits Administration", status: "live", description: "HR-managed plan catalog and enrollment; employer cost and employee deduction per pay run." },
  { name: "Payroll Processing", status: "live", description: "Atomic pay-run creation with a balanced double-entry ledger; new-hire pay is prorated to actual days employed this period. Termination and mid-period salary-change proration are not built." },
  { name: "Payslips", status: "live", description: "Itemised digital payslips with a step-by-step \"· how?\" derivation of every figure." },
  { name: "Direct Deposit & Payments", status: "roadmap", description: "Employee bank account (NUBAN) capture is real, and Integrations shows real coverage. Net pay is posted to the ledger; still no bank disbursement file or transfer integration." },
  { name: "Expense Reimbursement", status: "live", description: "Claims, admin/payroll approval with taxable/non-taxable treatment, paid via next run." },
  { name: "Compliance", status: "live", description: "PAYE, pension, NHF, NHIS, NSITF, ITF and WHT schemes with TIN gating before every run." },
  { name: "Employee Self-Service", status: "live", description: "Payslips, leave, loans, expenses, benefits and notifications in one dashboard." },
  { name: "Manager Self-Service", status: "live", description: "Direct-report roster and leave approval for any employee with reports." },
  { name: "Reporting & Analytics", status: "live", description: "Statutory liability totals and PAYE-by-state breakdowns." },
  { name: "Accounting Integration", status: "partial", description: "Real, fully itemised general-ledger CSV export per pay run. No live accounting-software API sync (QuickBooks, Xero, Sage) yet." },
  { name: "Workflow & Approvals", status: "live", description: "Leave, loan, expense and benefit-enrollment approval flows across admin/HR/payroll/manager roles." },
  { name: "Notifications", status: "live", description: "Requests and decisions notify the right people; unread counts surface in the sidebar and on /me." },
  { name: "Security", status: "live", description: "Role-based access (admin/payroll manager/HR manager/employee), mandatory TOTP MFA for admin and payroll manager, an org-scoped authentication audit log, and per-employee salary masking from HR Manager view (a real database-level mask, not just a hidden UI field)." },
  { name: "Multi-Company & Global Payroll", status: "roadmap", description: "Nigeria only. Ghana (SSNIT) and Kenya (NSSF/SHIF) rule sets are roadmap, not built." },
  { name: "Integrations", status: "partial", description: "Bank disbursement connections are a real per-org toggle, but explicitly a demo — no bank API calls, no disbursement file generation." },
  { name: "Final Settlement", status: "live", description: "Exit payroll: leave payout, gratuity and full loan clearance in one off-cycle run." },
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
