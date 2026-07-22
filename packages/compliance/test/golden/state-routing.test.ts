import { describe, expect, it } from "vitest";
import { aggregatePayeByState, totalPaye, type EmployeePayeLiability } from "../../src/engine/state-routing.js";
import { nairaToKobo } from "../../src/money.js";

describe("Multi-state workforce → per-state liability sums to org total", () => {
  const liabilities: EmployeePayeLiability[] = [
    { employeeId: "emp-1", state: "Lagos", paye: nairaToKobo(50_000) },
    { employeeId: "emp-2", state: "Lagos", paye: nairaToKobo(30_000) },
    { employeeId: "emp-3", state: "Rivers", paye: nairaToKobo(45_000) },
    { employeeId: "emp-4", state: "FCT", paye: nairaToKobo(70_000) },
    { employeeId: "emp-5", state: "Rivers", paye: nairaToKobo(10_000) },
  ];

  it("sums per-state totals back to the org-wide total", () => {
    const byState = aggregatePayeByState(liabilities);

    expect(byState.get("Lagos")).toBe(nairaToKobo(80_000));
    expect(byState.get("Rivers")).toBe(nairaToKobo(55_000));
    expect(byState.get("FCT")).toBe(nairaToKobo(70_000));

    const sumOfStates = [...byState.values()].reduce((a, b) => a + b, 0n);
    expect(sumOfStates).toBe(totalPaye(liabilities));
    expect(sumOfStates).toBe(nairaToKobo(205_000));
  });
});
