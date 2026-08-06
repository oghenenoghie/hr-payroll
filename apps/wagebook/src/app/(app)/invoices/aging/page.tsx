import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { toNaira } from "@plutus/compliance";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

type Bucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1-30 days" },
  { key: "d31_60", label: "31-60 days" },
  { key: "d61_90", label: "61-90 days" },
  { key: "d90_plus", label: "90+ days" },
];

export default async function InvoicesAgingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (
    !membership ||
    (membership.role !== "admin" &&
      membership.role !== "payroll_manager" &&
      membership.role !== "accountant" &&
      membership.role !== "auditor")
  ) {
    redirect("/dashboard");
  }

  const { data: issuedInvoices } = await supabase
    .from("customer_invoices")
    .select("id, amount_kobo, invoice_date, due_date, customer_id, customers(name)")
    .eq("status", "issued")
    .order("due_date", { ascending: true, nullsFirst: true });

  const invoiceIds = (issuedInvoices ?? []).map((i) => i.id);

  // Outstanding balance per invoice: amount minus every payment and credit
  // note posted against it — same derivation as the Invoices page itself,
  // never a stored column (see the partial-payments migration).
  const [{ data: payments }, { data: creditNotes }] = await Promise.all([
    invoiceIds.length > 0
      ? supabase.from("customer_invoice_payments").select("invoice_id, amount_kobo").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
    invoiceIds.length > 0
      ? supabase.from("customer_credit_notes").select("invoice_id, amount_kobo").in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] }),
  ]);
  const settledByInvoice = new Map<string, bigint>();
  for (const p of payments ?? []) {
    settledByInvoice.set(p.invoice_id, (settledByInvoice.get(p.invoice_id) ?? 0n) + BigInt(p.amount_kobo));
  }
  for (const c of creditNotes ?? []) {
    settledByInvoice.set(c.invoice_id, (settledByInvoice.get(c.invoice_id) ?? 0n) + BigInt(c.amount_kobo));
  }

  const todayTime = new Date().setHours(0, 0, 0, 0);

  function bucketFor(daysPastDue: number): Bucket {
    if (daysPastDue <= 0) return "current";
    if (daysPastDue <= 30) return "d1_30";
    if (daysPastDue <= 60) return "d31_60";
    if (daysPastDue <= 90) return "d61_90";
    return "d90_plus";
  }

  type CustomerRow = { customerId: string; customerName: string; totals: Record<Bucket, bigint>; grandTotal: bigint };
  const rowsByCustomer = new Map<string, CustomerRow>();

  for (const invoice of issuedInvoices ?? []) {
    const outstanding = BigInt(invoice.amount_kobo) - (settledByInvoice.get(invoice.id) ?? 0n);
    if (outstanding <= 0n) continue;

    // due_date falls back to invoice_date — an invoice with no due date
    // on file is treated as due the day it was issued, the only other
    // date this record actually has.
    const referenceDate = invoice.due_date ?? invoice.invoice_date;
    const daysPastDue = Math.round((todayTime - new Date(referenceDate).setHours(0, 0, 0, 0)) / 86_400_000);
    const bucket = bucketFor(daysPastDue);

    const customerId = invoice.customer_id;
    const row = rowsByCustomer.get(customerId) ?? {
      customerId,
      customerName: invoice.customers?.name ?? "—",
      totals: { current: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, d90_plus: 0n },
      grandTotal: 0n,
    };
    row.totals[bucket] += outstanding;
    row.grandTotal += outstanding;
    rowsByCustomer.set(customerId, row);
  }

  const rows = Array.from(rowsByCustomer.values()).sort((a, b) => (b.grandTotal > a.grandTotal ? 1 : -1));
  const columnTotals: Record<Bucket, bigint> = { current: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, d90_plus: 0n };
  let grandTotal = 0n;
  for (const row of rows) {
    for (const bucket of BUCKETS) {
      columnTotals[bucket.key] += row.totals[bucket.key];
    }
    grandTotal += row.grandTotal;
  }

  const csv = toCsv(
    ["Customer", ...BUCKETS.map((b) => b.label), "Total outstanding"],
    rows.map((row) => [
      row.customerName,
      ...BUCKETS.map((b) => toNaira(row.totals[b.key]).toFixed(2)),
      toNaira(row.grandTotal).toFixed(2),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
          {rows.length > 0 && <ExportCsvButton csv={csv} filename="ar-aging.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Aging report</h1>
        <p className="text-[13px] text-ink-soft">
          Every issued invoice&apos;s outstanding balance, by customer, bucketed by days past due date (or invoice
          date, for an invoice with no due date on file). Paid and void invoices don&apos;t appear here.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Customer</th>
              {BUCKETS.map((b) => (
                <th key={b.key} className={`${thClass} text-right`}>
                  {b.label}
                </th>
              ))}
              <th className={`${thClass} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.customerId} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{row.customerName}</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className={`${tdClass} text-right ${row.totals[b.key] > 0n ? "text-ink" : "text-ink-soft"}`}>
                      {row.totals[b.key] > 0n ? formatKobo(row.totals[b.key]) : "—"}
                    </td>
                  ))}
                  <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(row.grandTotal)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={BUCKETS.length + 2} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  Nothing outstanding — every issued invoice is fully settled.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className={`${tdClass} font-extrabold text-ink`}>Total</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className={`${tdClass} text-right font-extrabold text-ink`}>
                    {formatKobo(columnTotals[b.key])}
                  </td>
                ))}
                <td className={`${tdClass} text-right font-extrabold text-ink`}>{formatKobo(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Link href="/invoices" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Invoices
      </Link>
    </div>
  );
}
