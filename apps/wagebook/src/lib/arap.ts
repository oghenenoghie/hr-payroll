import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@plutus/core";

/** Sum of every payment and credit note posted against each invoice id in
 * `invoiceIds` — never a stored column, always derived on read (see the
 * partial-payments migration). Shared by every page that needs an
 * invoice's outstanding balance, so this derivation lives in one place
 * instead of being copy-pasted per page. */
export async function getSettledByInvoice(
  supabase: SupabaseClient<Database>,
  invoiceIds: string[],
): Promise<Map<string, bigint>> {
  const settledByInvoice = new Map<string, bigint>();
  if (invoiceIds.length === 0) return settledByInvoice;

  const [{ data: payments }, { data: creditNotes }] = await Promise.all([
    supabase.from("customer_invoice_payments").select("invoice_id, amount_kobo").in("invoice_id", invoiceIds),
    supabase.from("customer_credit_notes").select("invoice_id, amount_kobo").in("invoice_id", invoiceIds),
  ]);
  for (const p of payments ?? []) {
    settledByInvoice.set(p.invoice_id, (settledByInvoice.get(p.invoice_id) ?? 0n) + BigInt(p.amount_kobo));
  }
  for (const c of creditNotes ?? []) {
    settledByInvoice.set(c.invoice_id, (settledByInvoice.get(c.invoice_id) ?? 0n) + BigInt(c.amount_kobo));
  }
  return settledByInvoice;
}

export function invoiceOutstandingKobo(
  invoice: { id: string; amount_kobo: number },
  settledByInvoice: Map<string, bigint>,
): bigint {
  return BigInt(invoice.amount_kobo) - (settledByInvoice.get(invoice.id) ?? 0n);
}
