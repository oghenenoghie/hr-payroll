import { naira, rate } from "../money";
import type { RuleVersion } from "../types";

/**
 * Nigeria Tax Act 2025, effective 1 January 2026.
 * Source: references/nigeria-statutory-compliance.md (Plutus skill) — re-confirm
 * against NRS/PenCom/FMBN/NSITF/ITF primary guidance before production use;
 * the 2026 reform is recent and guidance is still settling.
 */
export const NG_2026_1: RuleVersion = {
  id: "NG-2026.1",
  country: "NG",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,

  paye: {
    bands: [
      { upToKobo: naira(800_000), rateScaled: rate(0) },
      { upToKobo: naira(3_000_000), rateScaled: rate(15) },
      { upToKobo: naira(12_000_000), rateScaled: rate(18) },
      { upToKobo: naira(25_000_000), rateScaled: rate(21) },
      { upToKobo: naira(50_000_000), rateScaled: rate(23) },
      { upToKobo: null, rateScaled: rate(25) },
    ],
    taxFreeThresholdKobo: naira(800_000),
    rentRelief: { rateScaled: rate(20), capKobo: naira(500_000) },
    remittance: { authority: "STATE_IRS", dueDayOfFollowingMonth: 10 },
  },

  pension: {
    baseComponentCodes: ["basic", "housing", "transport"],
    employeeRateScaled: rate(8),
    employerRateScaled: rate(10),
    remittance: { authority: "PFA", dueWorkingDaysAfterPayment: 7 },
  },

  nhf: {
    baseComponentCodes: ["basic"],
    rateScaled: rate(2.5),
    remittance: { authority: "FMBN", dueMonthsAfterPayment: 1 },
  },

  nsitf: {
    rateScaled: rate(1),
    borneBy: "EMPLOYER",
    remittance: { authority: "NSITF", dueDayOfFollowingMonth: 16 },
  },

  itf: {
    rateScaled: rate(1),
    borneBy: "EMPLOYER",
    qualifyingThreshold: { minEmployees: 5, minAnnualTurnoverKobo: naira(50_000_000) },
    remittance: { authority: "ITF", dueAnnuallyOn: "04-01" },
  },

  wht: {
    ratesScaledByCategory: {
      goods_and_materials: rate(5),
      professional_services: rate(10),
      construction: rate(5),
      rent: rate(10),
      dividend_interest_royalty: rate(10),
    },
    remittance: { dueDayOfFollowingMonth: 21 },
  },

  nhis: { resolveByScheme: true },
};
