import type { TinStatus } from "../types";

export class TinGateError extends Error {
  constructor(public readonly blockedEmployeeIds: readonly string[]) {
    super(
      `Payroll run blocked: ${blockedEmployeeIds.length} employee(s) without a valid TIN: ${blockedEmployeeIds.join(", ")}`,
    );
    this.name = "TinGateError";
  }
}

export function isTinValid(status: TinStatus, asOf: string): boolean {
  if (!status.tin || status.tin.trim() === "") return false;
  if (status.validFrom && asOf < status.validFrom) return false;
  if (status.validTo && asOf >= status.validTo) return false;
  return true;
}

/**
 * A run must not silently process a TIN-less employee. Call this before
 * running payroll — never after, as an audit finding.
 */
export function assertTinGate(
  employees: readonly { id: string; tin: TinStatus }[],
  asOf: string,
): void {
  const blocked = employees.filter((employee) => !isTinValid(employee.tin, asOf)).map((e) => e.id);
  if (blocked.length > 0) {
    throw new TinGateError(blocked);
  }
}
