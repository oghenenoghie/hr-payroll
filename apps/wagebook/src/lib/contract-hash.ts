// Pins a signature to the exact contract content at the moment it was
// signed — computed identically here by both the signing action and the
// page that decides whether an existing signature still covers what's
// rendered today. If HR edits any of these fields afterward, the newly
// computed hash no longer matches the stored one, so the page correctly
// stops treating the old signature as current (see the migration comment
// on employment_contract_signatures for the full reasoning). The key
// list and order are fixed on purpose — JSON.stringify's replacer array
// controls both which fields are included and their order, so the same
// input object always serializes identically regardless of how its
// properties were originally set.
export type ContractFields = {
  employmentType: string;
  hireDate: string | null;
  contractEndDate: string | null;
  jobGradeName: string | null;
  departmentName: string | null;
  probationEndDate: string | null;
  confirmed: boolean;
  annualLeaveBalanceDays: number;
  basicKobo: number | null;
  housingKobo: number | null;
  transportKobo: number | null;
};

const FIELD_ORDER: (keyof ContractFields)[] = [
  "employmentType",
  "hireDate",
  "contractEndDate",
  "jobGradeName",
  "departmentName",
  "probationEndDate",
  "confirmed",
  "annualLeaveBalanceDays",
  "basicKobo",
  "housingKobo",
  "transportKobo",
];

export async function computeContractHash(fields: ContractFields): Promise<string> {
  const canonical = JSON.stringify(fields, FIELD_ORDER);
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
