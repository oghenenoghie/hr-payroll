import { describe, expect, it } from "vitest";
import { assertTinGate, isTinValid, TinGateError } from "../../src/engine/tin-gate.js";

const ASOF = "2026-02-01";

describe("TIN gating — a run must not silently process a TIN-less employee", () => {
  it("blocks the run when any employee lacks a valid TIN", () => {
    const employees = [
      { id: "emp-1", tin: { tin: "12345678-0001" } },
      { id: "emp-2", tin: { tin: null } },
      { id: "emp-3", tin: { tin: "" } },
    ];

    expect(() => assertTinGate(employees, ASOF)).toThrow(TinGateError);

    let caught: unknown;
    try {
      assertTinGate(employees, ASOF);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TinGateError);
    expect((caught as TinGateError).blockedEmployeeIds).toEqual(["emp-2", "emp-3"]);
  });

  it("does not block a run where every employee has a valid TIN", () => {
    const employees = [
      { id: "emp-1", tin: { tin: "12345678-0001" } },
      { id: "emp-2", tin: { tin: "98765432-0002" } },
    ];
    expect(() => assertTinGate(employees, ASOF)).not.toThrow();
  });

  it("treats a TIN outside its validity window as invalid", () => {
    expect(isTinValid({ tin: "X", validFrom: "2026-03-01" }, ASOF)).toBe(false);
    expect(isTinValid({ tin: "X", validTo: "2026-01-01" }, ASOF)).toBe(false);
    expect(isTinValid({ tin: "X", validFrom: "2026-01-01", validTo: "2027-01-01" }, ASOF)).toBe(true);
  });
});
