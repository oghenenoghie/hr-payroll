import type { Kobo } from "./money";

/** The three per-employee pay components that feed pension and NHF bases. */
export type PayComponent = "basic" | "housing" | "transport";

export type Country = "NG";

export interface Org {
  employeeCount: number;
  annualPayrollKobo: Kobo;
}

/** A single progressive tax band. `upTo: null` means "and above". */
export interface PayeBand {
  upTo: Kobo | null;
  rate: number;
}

export interface RemittanceDueDay {
  authority: "STATE_IRS";
  dueDay: number;
}

export interface RemittanceWorkingDays {
  authority: "PFA";
  dueWorkingDaysAfterPayment: number;
}

export interface RemittanceMonthsAfterPayment {
  authority: "FMBN";
  dueMonthsAfterPayment: number;
}

export interface RemittanceDayOfFollowingMonth {
  authority: "NSITF" | "NRS" | "STATE_IRS";
  dueDayOfFollowingMonth: number;
}

export interface RemittanceAnnual {
  authority: "ITF";
  dueAnnuallyOn: string; // "MM-DD"
}

/**
 * Rules are data, effective-dated, and centrally versioned. A payroll run
 * pins the rule version it used so results stay immutable and reproducible.
 * A change in the law means a new rule version, never an edit in place.
 */
export interface RuleVersion {
  id: string; // "NG-2026.1"
  country: Country;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null; // ISO date, exclusive

  paye: {
    bands: PayeBand[];
    taxFreeThreshold: Kobo;
    rentRelief: { rate: number; cap: Kobo };
    remittance: RemittanceDueDay;
  };

  pension: {
    base: PayComponent[];
    employeeRate: number;
    employerRate: number;
    remittance: RemittanceWorkingDays;
  };

  nhf: {
    base: PayComponent[];
    rate: number;
    remittance: RemittanceMonthsAfterPayment;
  };

  nsitf: {
    base: "TOTAL_MONTHLY_PAYROLL";
    rate: number;
    borneBy: "EMPLOYER";
    remittance: RemittanceDayOfFollowingMonth;
  };

  itf: {
    base: "ANNUAL_PAYROLL";
    rate: number;
    borneBy: "EMPLOYER";
    qualifies: (org: Org) => boolean;
    remittance: RemittanceAnnual;
  };

  nhis: {
    resolveByScheme: true;
  };

  wht: {
    ratesByCategory: Record<string, number>;
    remittance: RemittanceDayOfFollowingMonth;
  };
}

/** Per-employee pay components in kobo, as actually stored — never a derived split. */
export interface PayComponents {
  basic: Kobo;
  housing: Kobo;
  transport: Kobo;
}

export interface TinStatus {
  tin: string | null;
  validFrom?: string;
  validTo?: string;
}
