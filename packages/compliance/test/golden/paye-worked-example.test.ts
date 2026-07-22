import { describe, expect, it } from "vitest";
import { calculatePaye } from "../../src/engine/paye.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

describe("PAYE worked example (README §11)", () => {
  it("chargeable ₦3,162,000 → ₦359,160", () => {
    const paye = calculatePaye(nairaToKobo(3_162_000), NG_2026_1.paye.bands);
    expect(paye).toBe(nairaToKobo(359_160));
  });
});
