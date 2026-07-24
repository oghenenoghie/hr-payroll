/**
 * Nigeria Uniform Bank Account Number (NUBAN) check-digit validation, per
 * the CBN's "Revised Standards on Nigeria Uniform Bank Account Number
 * (NUBAN) for Banks and Other Financial Institutions" (2020) — cross-checked
 * against two independent open-source implementations of the same spec
 * before shipping, since a wrong formula here would either reject valid
 * accounts or silently accept typos.
 *
 * This confirms the account number is internally consistent with the
 * selected bank's own numbering — it does NOT confirm the account exists or
 * belongs to the stated account holder. That needs a live bank-verification
 * API call, which this build doesn't make (see the Integrations page: bank
 * disbursement is a demo toggle, no real bank API calls).
 */
export interface NubanBank {
  name: string;
  code: string;
}

// A curated set of Nigeria's major commercial/merchant banks and their
// 3-digit CBN/NIP institution codes. Not exhaustive of every microfinance
// bank or payment service bank — an employee at an unlisted institution
// uses "Other", which skips checksum validation but still enforces the
// 10-digit NUBAN format.
export const NUBAN_BANKS: readonly NubanBank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank", code: "214" },
  { name: "Guaranty Trust Bank", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Lotus Bank", code: "303" },
  { name: "Parallex Bank", code: "104" },
  { name: "Polaris Bank", code: "076" },
  { name: "PremiumTrust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

// The CBN algorithm weights the 3-digit bank code together with the first
// 9 digits of the 10-digit account number (12 digits total) — the 10th
// digit of the account number is the check digit being verified, so it is
// never itself part of the weighted sum. The 3,7,3 pattern repeats every
// three digits across the full 12.
const NUBAN_CHECK_WEIGHT_CYCLE = [3, 7, 3] as const;

export function nubanCheckDigit(bankCode: string, accountSerial: string): number {
  const digits = `${bankCode}${accountSerial}`.split("").map(Number);
  const sum = digits.reduce((total, digit, i) => total + digit * NUBAN_CHECK_WEIGHT_CYCLE[i % 3]!, 0);
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

export function isValidNuban(bankCode: string, accountNumber: string): boolean {
  if (!/^\d{3}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    return false;
  }
  const serial = accountNumber.slice(0, 9);
  const providedCheckDigit = Number(accountNumber[9]);
  return nubanCheckDigit(bankCode, serial) === providedCheckDigit;
}

export function findNubanBankCode(bankName: string): string | undefined {
  return NUBAN_BANKS.find((bank) => bank.name === bankName)?.code;
}
