import { describe, expect, it } from "vitest";
import { findNubanBankCode, isValidNuban, NUBAN_BANKS, nubanCheckDigit } from "../src/nuban";

describe("NUBAN check digit (CBN 2020 spec)", () => {
  it("matches the published GTBank worked example: 058 / 001656322 -> check digit 8", () => {
    expect(nubanCheckDigit("058", "001656322")).toBe(8);
    expect(isValidNuban("058", "0016563228")).toBe(true);
  });

  it("rejects a single mistyped digit in an otherwise valid NUBAN", () => {
    expect(isValidNuban("058", "0016563229")).toBe(false);
    expect(isValidNuban("058", "0016563218")).toBe(false);
  });

  it("rejects a valid serial paired with the wrong bank code", () => {
    expect(isValidNuban("044", "0016563228")).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    expect(isValidNuban("58", "0016563228")).toBe(false);
    expect(isValidNuban("058", "123")).toBe(false);
    expect(isValidNuban("058", "not-a-number")).toBe(false);
  });

  it("resets a check digit of 10 to 0", () => {
    // Any bank code/serial combination whose weighted sum is a multiple of
    // 10 must map to check digit 0, never 10 — the CBN spec's explicit edge
    // case, since a two-digit check value would break the 10-digit format.
    const zeroSumSerial = "000000000";
    expect(nubanCheckDigit("000", zeroSumSerial)).toBe(0);
  });

  it("every curated bank has a unique 3-digit code and every code round-trips through findNubanBankCode", () => {
    const codes = NUBAN_BANKS.map((bank) => bank.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const bank of NUBAN_BANKS) {
      expect(bank.code).toMatch(/^\d{3}$/);
      expect(findNubanBankCode(bank.name)).toBe(bank.code);
    }
  });

  it("returns undefined for a bank name outside the curated list", () => {
    expect(findNubanBankCode("Not A Real Bank")).toBeUndefined();
  });
});
