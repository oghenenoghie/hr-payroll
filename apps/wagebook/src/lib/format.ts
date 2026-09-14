import { toNaira, type Kobo } from "@plutus/compliance";

export function formatKobo(amountKobo: Kobo): string {
  return `₦${Math.round(toNaira(amountKobo)).toLocaleString("en-NG")}`;
}

export function formatPercent(rateScaled: bigint): string {
  return `${(Number(rateScaled) / 10_000).toLocaleString("en-NG")}%`;
}

/** First letter of the first two words of a name, for a placeholder
 * avatar when no profile photo is on file. */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
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

export type EmployeeLifecycleStage =
  | "onboarding"
  | "probation"
  | "confirmed"
  | "active"
  | "suspended"
  | "offboarding"
  | "exited";

export interface EmployeeLifecycleInput {
  status: string;
  confirmed: boolean;
  probationEndDate: string | null;
  onboardingDocumentationCollected: boolean;
  onboardingContractSigned: boolean;
  offboardingNoticePeriodServed: boolean;
  offboardingAssetsReturned: boolean;
  offboardingClearanceObtained: boolean;
  offboardingExperienceLetterIssued: boolean;
}

/**
 * feature-backlog.md §2's "Employee lifecycle as an explicit spine" —
 * scoped to the employee record itself (recruitment's separate
 * candidate → hire pipeline is out of scope here, not merged into this).
 *
 * Deliberately a plain computed function, never a stored column — the
 * same "can't drift from reality" reasoning as getProbationStatus,
 * getContractStatus and getPendingAgeTone above. The underlying flags
 * (employees.status/confirmed/probation_end_date, the onboarding and
 * offboarding checklist tables) are already each independently correct
 * and independently auditable (employee_status_history logs every status
 * change); what was missing was a single derived answer to "what stage is
 * this employee at right now" that other screens could read instead of
 * combining those flags themselves each time. This is that single answer,
 * not a new source of truth.
 *
 * Precedence, most specific first: terminated always wins (exited once
 * every offboarding step is done, offboarding until then); suspended is
 * next; then onboarding (if either checklist item is outstanding);
 * confirmed if the confirmed flag is set; probation if a probation end
 * date is on file and hasn't been superseded by confirmation; otherwise
 * a plain "active" employee with no probation ever configured for them.
 */
export function getEmployeeLifecycleStage(input: EmployeeLifecycleInput): EmployeeLifecycleStage {
  if (input.status === "terminated") {
    const offboardingComplete =
      input.offboardingNoticePeriodServed &&
      input.offboardingAssetsReturned &&
      input.offboardingClearanceObtained &&
      input.offboardingExperienceLetterIssued;
    return offboardingComplete ? "exited" : "offboarding";
  }
  if (input.status === "suspended") return "suspended";
  if (!input.onboardingDocumentationCollected || !input.onboardingContractSigned) return "onboarding";
  if (input.confirmed) return "confirmed";
  if (input.probationEndDate) return "probation";
  return "active";
}

const PENDING_AGE_WARN_DAYS = 7;

/** Same plain-data-function reasoning as getProbationStatus/getContractStatus.
 * A row-level "this has been waiting a while" signal for approval queues
 * (loans, expenses, bills) that have no due-date concept of their own —
 * computed from created_at, never a stored column, so it can't drift from
 * reality. */
export function getPendingAgeTone(createdAt: string): "neutral" | "warn" {
  const daysPending = Math.round((Date.now() - Date.parse(createdAt)) / 86_400_000);
  return daysPending > PENDING_AGE_WARN_DAYS ? "warn" : "neutral";
}
