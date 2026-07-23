// Every account_code this codebase actually posts to (payroll runs and
// final settlements) — see payroll/new/actions.ts and
// employees/[id]/settle/actions.ts. Kept in one place so the payroll-run
// detail page and the general ledger CSV export label accounts the same
// way, and so a new posting line added later has one spot to register a
// friendly name.
export const ACCOUNT_LABEL: Record<string, string> = {
  payroll_expense: "Payroll expense",
  expense_reimbursement_expense: "Expense reimbursement expense",
  overtime_pay_expense: "Overtime pay expense",
  employer_pension_expense: "Employer pension expense",
  benefits_expense: "Benefits expense",
  leave_payout_expense: "Leave payout expense (final settlement)",
  gratuity_expense: "Gratuity expense (final settlement)",
  net_pay_payable: "Net pay payable",
  paye_payable: "PAYE payable (due FIRS/state IRS, before the 10th)",
  pension_payable: "Pension payable (due PFA, before the 7th)",
  nhf_payable: "NHF payable (due FMBN, before the 10th)",
  staff_loans_receivable: "Staff loans receivable",
  benefits_payable: "Benefits payable",
  nsitf_expense: "NSITF expense",
  nsitf_payable: "NSITF payable (due NSITF, before the 16th)",
};
