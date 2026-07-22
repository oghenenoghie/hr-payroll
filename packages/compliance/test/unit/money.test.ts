import { describe, expect, it } from "vitest";
import { applyRate, clampNonNegative, koboToNaira, max, min, nairaToKobo, sum } from "../../src/money.js";

describe("money", () => {
  it("converts naira to kobo and back", () => {
    expect(nairaToKobo(1_000)).toBe(100_000n);
    expect(koboToNaira(100_000n)).toBe(1_000);
  });

  it("applies a rate with round-half-up, staying in bigint throughout", () => {
    expect(applyRate(nairaToKobo(300_000), 0.08)).toBe(nairaToKobo(24_000));
    expect(applyRate(3n, 0.5)).toBe(2n); // 1.5 rounds up to 2
  });

  it("clamps negative amounts to zero", () => {
    expect(clampNonNegative(-5n)).toBe(0n);
    expect(clampNonNegative(5n)).toBe(5n);
  });

  it("sum, min, max", () => {
    expect(sum([1n, 2n, 3n])).toBe(6n);
    expect(min(3n, 5n)).toBe(3n);
    expect(max(3n, 5n)).toBe(5n);
  });
});
