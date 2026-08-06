import { applyRate, type Kobo } from "../money";
import type { RuleVersion } from "../types";
import { computeWht } from "./wht";

export interface VatResult {
  vatKobo: Kobo;
  exempt: boolean;
}

/** Resolved by category — exempt/zero-rated categories are charged at 0%,
 * never a blanket flat rate applied regardless of what's being supplied. */
export function computeVat(amountKobo: Kobo, category: string, ruleVersion: RuleVersion): VatResult {
  const exempt = ruleVersion.vat.exemptCategories.includes(category);
  return {
    vatKobo: exempt ? 0n : applyRate(amountKobo, ruleVersion.vat.standardRateScaled),
    exempt,
  };
}

export interface VendorInvoiceInput {
  subtotalKobo: Kobo;
  vatCategory: string;
  /** WHT service category — see UnknownWhtCategoryError if unrecognised. */
  whtCategory: string;
}

export interface VendorInvoiceResult {
  subtotalKobo: Kobo;
  vatKobo: Kobo;
  vatExempt: boolean;
  /** Subtotal + VAT — the amount stated on the vendor's invoice. */
  invoiceTotalKobo: Kobo;
  /** Withheld at source by the payer and remitted on the vendor's behalf —
   * computed on the VAT-exclusive subtotal, per FIRS guidance, never on the
   * VAT-inclusive total. */
  whtKobo: Kobo;
  /** invoiceTotalKobo − whtKobo — what the vendor actually receives. */
  netPayableToVendorKobo: Kobo;
}

/**
 * Derives a vendor/contractor invoice's totals: VAT is added on top of the
 * subtotal (output tax the vendor charges), WHT is withheld from the
 * payment (deducted at source and remitted on the vendor's behalf) —
 * two independent, unrelated taxes that must never be conflated into a
 * single rate. See nigeria-statutory-compliance.md §8.
 */
export function computeVendorInvoiceTotals(input: VendorInvoiceInput, ruleVersion: RuleVersion): VendorInvoiceResult {
  const { subtotalKobo, vatCategory, whtCategory } = input;

  const { vatKobo, exempt: vatExempt } = computeVat(subtotalKobo, vatCategory, ruleVersion);
  const invoiceTotalKobo = subtotalKobo + vatKobo;
  const whtKobo = computeWht(subtotalKobo, whtCategory, ruleVersion);
  const netPayableToVendorKobo = invoiceTotalKobo - whtKobo;

  return { subtotalKobo, vatKobo, vatExempt, invoiceTotalKobo, whtKobo, netPayableToVendorKobo };
}
