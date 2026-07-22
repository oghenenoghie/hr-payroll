import type { Kobo } from "./money";

export type ComponentCode = "basic" | "housing" | "transport" | (string & {});

/** NSITF's base excludes bonus/overtime/13th-month/one-off pay — tag every
 * component so scheme calculators can select the right base without guessing. */
export type PayComponentKind = "regular" | "bonus" | "overtime" | "thirteenth_month" | "one_off";

export interface PayComponent {
  code: ComponentCode;
  amountKobo: Kobo;
  kind: PayComponentKind;
}

export type BorneBy = "EMPLOYEE" | "EMPLOYER" | "BOTH";

export interface PayeBand {
  /** Upper bound of this band's chargeable income, in kobo. `null` = unbounded top band. */
  upToKobo: Kobo | null;
  /** Marginal rate, scaled per money.ts RATE_SCALE. */
  rateScaled: bigint;
}

export interface OrgStatutoryProfile {
  employeeCount: number;
  annualTurnoverKobo: Kobo;
}

export interface RuleVersion {
  id: string;
  country: "NG";
  effectiveFrom: string;
  effectiveTo: string | null;

  paye: {
    bands: PayeBand[];
    taxFreeThresholdKobo: Kobo;
    rentRelief: { rateScaled: bigint; capKobo: Kobo };
    remittance: { authority: "STATE_IRS"; dueDayOfFollowingMonth: number };
  };

  pension: {
    baseComponentCodes: ComponentCode[];
    employeeRateScaled: bigint;
    employerRateScaled: bigint;
    remittance: { authority: "PFA"; dueWorkingDaysAfterPayment: number };
  };

  nhf: {
    baseComponentCodes: ComponentCode[];
    rateScaled: bigint;
    remittance: { authority: "FMBN"; dueMonthsAfterPayment: number };
  };

  nsitf: {
    rateScaled: bigint;
    borneBy: "EMPLOYER";
    remittance: { authority: "NSITF"; dueDayOfFollowingMonth: number };
  };

  itf: {
    rateScaled: bigint;
    borneBy: "EMPLOYER";
    qualifyingThreshold: { minEmployees: number; minAnnualTurnoverKobo: Kobo };
    remittance: { authority: "ITF"; dueAnnuallyOn: string };
  };

  wht: {
    ratesScaledByCategory: Record<string, bigint>;
    remittance: { dueDayOfFollowingMonth: number };
  };

  /** NHIS/NHIA rates are scheme-specific, not a single national figure — see
   * nigeria-statutory-compliance.md §5. No default is provided on purpose. */
  nhis: {
    resolveByScheme: true;
  };
}
