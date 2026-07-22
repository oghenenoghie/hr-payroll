export class TinRequiredError extends Error {
  constructor(public readonly employeeId: string) {
    super(`Employee ${employeeId} has no valid TIN — payroll run must be blocked, not silently processed.`);
    this.name = "TinRequiredError";
  }
}
