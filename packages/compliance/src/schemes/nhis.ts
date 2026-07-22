import { applyRate, type Kobo } from "../money";

export class NhisSchemeNotConfiguredError extends Error {
  constructor(public readonly schemeId: string) {
    super(`No rate configured for NHIS/NHIA scheme "${schemeId}" — do not assume a single national rate.`);
    this.name = "NhisSchemeNotConfiguredError";
  }
}

export interface NhisSchemeConfig {
  employeeRateScaled: bigint;
  employerRateScaled: bigint;
}

/**
 * NHIS/NHIA has no single national rate — it varies by the applicable state
 * or federal scheme. Callers must supply the org's enrolled scheme config;
 * this deliberately has no fallback default (see nigeria-statutory-compliance.md §5).
 */
export function computeNhis(baseKobo: Kobo, schemeId: string, schemes: Record<string, NhisSchemeConfig>) {
  const scheme = schemes[schemeId];
  if (!scheme) throw new NhisSchemeNotConfiguredError(schemeId);
  return {
    employeeKobo: applyRate(baseKobo, scheme.employeeRateScaled),
    employerKobo: applyRate(baseKobo, scheme.employerRateScaled),
  };
}
