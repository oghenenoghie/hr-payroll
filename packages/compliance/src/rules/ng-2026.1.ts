import { nairaToKobo } from "../money";
import type { RuleVersion } from "../types";

/**
 * Nigeria Tax Act 2025 framework, effective 1 January 2026.
 * Source: README §8 "Statutory reference" (Plutus repo).
 *
 * The 2026 reform is recent and guidance is still settling. Figures below
 * marked NEEDS VERIFICATION come from secondary/general practice and must
 * be re-confirmed against primary agency guidance (NRS, PenCom, FMBN,
 * NSITF, ITF) before this rule version is used for a live payroll run.
 */
export const NG_2026_1: RuleVersion = {
  id: "NG-2026.1",
  country: "NG",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,

  paye: {
    bands: [
      { upTo: nairaToKobo(800_000), rate: 0 },
      { upTo: nairaToKobo(3_000_000), rate: 0.15 },
      { upTo: nairaToKobo(12_000_000), rate: 0.18 },
      { upTo: nairaToKobo(25_000_000), rate: 0.21 },
      { upTo: nairaToKobo(50_000_000), rate: 0.23 },
      { upTo: null, rate: 0.25 },
    ],
    taxFreeThreshold: nairaToKobo(800_000),
    rentRelief: { rate: 0.2, cap: nairaToKobo(500_000) },
    remittance: { authority: "STATE_IRS", dueDay: 10 },
  },

  pension: {
    base: ["basic", "housing", "transport"],
    employeeRate: 0.08,
    employerRate: 0.1,
    remittance: { authority: "PFA", dueWorkingDaysAfterPayment: 7 },
  },

  nhf: {
    base: ["basic"],
    rate: 0.025,
    remittance: { authority: "FMBN", dueMonthsAfterPayment: 1 },
  },

  nsitf: {
    base: "TOTAL_MONTHLY_PAYROLL",
    rate: 0.01,
    borneBy: "EMPLOYER",
    remittance: { authority: "NSITF", dueDayOfFollowingMonth: 16 },
  },

  itf: {
    base: "ANNUAL_PAYROLL",
    rate: 0.01,
    borneBy: "EMPLOYER",
    // NEEDS VERIFICATION: ITF Act qualification threshold (headcount and/or
    // turnover) against current ITF guidance before go-live.
    qualifies: (org) => org.employeeCount >= 5 || org.annualPayrollKobo >= nairaToKobo(50_000_000),
    remittance: { authority: "ITF", dueAnnuallyOn: "04-01" },
  },

  nhis: {
    resolveByScheme: true,
  },

  wht: {
    // NEEDS VERIFICATION: full WHT category schedule against current NRS
    // guidance before go-live. This is a minimal starter set.
    ratesByCategory: {
      RENT: 0.1,
      DIVIDEND: 0.1,
      INTEREST: 0.1,
      ROYALTY: 0.1,
      CONSTRUCTION: 0.05,
      CONSULTANCY: 0.05,
      DIRECTOR_FEE: 0.15,
    },
    remittance: { authority: "NRS", dueDayOfFollowingMonth: 21 },
  },
};
