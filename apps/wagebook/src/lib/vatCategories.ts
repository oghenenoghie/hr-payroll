import { NG_2026_1 } from "@plutus/compliance";

/** Shared between InvoiceForm (AR) and BillForm (AP) — both price against
 * the same categorical VAT rate table, so the category picker they show
 * a user should never drift apart. */
export const vatRuleVersion = NG_2026_1;

export const VAT_CATEGORY_OPTIONS = [
  {
    value: "standard",
    label: `Standard-rated (${(Number(vatRuleVersion.vat.standardRateScaled) / 10_000).toLocaleString("en-NG")}%)`,
  },
  ...vatRuleVersion.vat.exemptCategories.map((category) => ({
    value: category,
    label: `${category.replace(/_/g, " ")} (exempt)`,
  })),
];
