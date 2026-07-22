import { describe, expect, it } from "vitest";
import { calculatePaye } from "../../src/engine/paye.js";
import { nairaToKobo } from "../../src/money.js";
import { NG_2026_1 } from "../../src/rules/ng-2026.1.js";

const bands = NG_2026_1.paye.bands;

function paye(naira: number): bigint {
  return calculatePaye(nairaToKobo(naira), bands);
}

describe("PAYE band boundaries (NG-2026.1)", () => {
  it("₦800,000 boundary — first band is 0%", () => {
    expect(paye(799_999)).toBe(0n);
    expect(paye(800_000)).toBe(0n);
    expect(paye(800_001)).toBe(15n); // 1 naira into the 15% band = 15 kobo
  });

  it("₦3,000,000 boundary — end of the 15% band", () => {
    expect(paye(2_999_999)).toBe(nairaToKobo(329_999.85));
    expect(paye(3_000_000)).toBe(nairaToKobo(330_000));
    expect(paye(3_000_001)).toBe(nairaToKobo(330_000) + 18n);
  });

  it("₦12,000,000 boundary — end of the 18% band", () => {
    expect(paye(11_999_999)).toBe(nairaToKobo(1_949_999.82));
    expect(paye(12_000_000)).toBe(nairaToKobo(1_950_000));
    expect(paye(12_000_001)).toBe(nairaToKobo(1_950_000) + 21n);
  });

  it("₦25,000,000 boundary — end of the 21% band", () => {
    expect(paye(24_999_999)).toBe(nairaToKobo(4_679_999.79));
    expect(paye(25_000_000)).toBe(nairaToKobo(4_680_000));
    expect(paye(25_000_001)).toBe(nairaToKobo(4_680_000) + 23n);
  });

  it("₦50,000,000 boundary — end of the 23% band, top band is 25%", () => {
    expect(paye(49_999_999)).toBe(nairaToKobo(10_429_999.77));
    expect(paye(50_000_000)).toBe(nairaToKobo(10_430_000));
    expect(paye(50_000_001)).toBe(nairaToKobo(10_430_000) + 25n);
  });
});
