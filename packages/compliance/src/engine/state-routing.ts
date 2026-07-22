import { sum, type Kobo } from "../money";

export interface EmployeePayeLiability {
  employeeId: string;
  state: string;
  paye: Kobo;
}

/**
 * PAYE is collected by each employee's state of residence. This maps every
 * employee's liability to their state and consolidates per-state totals —
 * the sum across states must always equal the org-wide total.
 */
export function aggregatePayeByState(
  liabilities: readonly EmployeePayeLiability[],
): Map<string, Kobo> {
  const byState = new Map<string, Kobo>();
  for (const liability of liabilities) {
    byState.set(liability.state, (byState.get(liability.state) ?? 0n) + liability.paye);
  }
  return byState;
}

export function totalPaye(liabilities: readonly EmployeePayeLiability[]): Kobo {
  return sum(liabilities.map((l) => l.paye));
}
