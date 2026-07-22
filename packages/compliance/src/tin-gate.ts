import { TinRequiredError } from "./errors";

export interface TinGateSubject {
  employeeId: string;
  tin: string | null;
}

/** Flags every TIN-less employee before a run proceeds — never silently. */
export function checkTinGate(employees: TinGateSubject[]): TinRequiredError[] {
  return employees.filter((e) => !e.tin).map((e) => new TinRequiredError(e.employeeId));
}

export function assertTinPresent(employee: TinGateSubject): void {
  if (!employee.tin) throw new TinRequiredError(employee.employeeId);
}
