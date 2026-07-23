import { toNaira, type Kobo } from "@plutus/compliance";

export function formatKobo(amountKobo: Kobo): string {
  return `₦${Math.round(toNaira(amountKobo)).toLocaleString("en-NG")}`;
}

export function formatPercent(rateScaled: bigint): string {
  return `${(Number(rateScaled) / 10_000).toLocaleString("en-NG")}%`;
}

export type ProbationStatus = "confirmed" | "overdue" | "ends_soon" | "on_probation" | "none";

/** Plain data derivation, not a component — Date.now() can't be called
 * inside a component body (react-hooks/purity), so this is computed by
 * the caller and passed into ProbationBadge as an already-derived status. */
export function getProbationStatus(probationEndDate: string | null, confirmed: boolean): ProbationStatus {
  if (confirmed) return "confirmed";
  if (!probationEndDate) return "none";
  const daysUntilEnd = Math.round((Date.parse(probationEndDate) - Date.now()) / 86_400_000);
  if (daysUntilEnd < 0) return "overdue";
  if (daysUntilEnd <= 14) return "ends_soon";
  return "on_probation";
}

export type ContractStatus = "permanent" | "expired" | "ends_soon" | "active" | "none";

/** Same plain-data-function reasoning as getProbationStatus: Date.now()
 * can't be called inside a component body. Permanent employees and anyone
 * without a contract_end_date get "none" -- expiry only applies to a
 * contract/intern employee with an actual end date on file. */
export function getContractStatus(employmentType: string, contractEndDate: string | null): ContractStatus {
  if (employmentType === "permanent") return "permanent";
  if (!contractEndDate) return "none";
  const daysUntilEnd = Math.round((Date.parse(contractEndDate) - Date.now()) / 86_400_000);
  if (daysUntilEnd < 0) return "expired";
  if (daysUntilEnd <= 14) return "ends_soon";
  return "active";
}
