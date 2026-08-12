import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { ACCOUNT_LABEL } from "@/lib/accounts";
import { VendorBillStatusBadge, OverdueBadge } from "@/components/Badge";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">{label}</span>
      <p className="mt-1 text-[17px] font-extrabold text-ink">{value}</p>
    </div>
  );
}

function TimelineStep({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-border bg-bg px-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-bold text-ink">{label}</span>
        <span className="text-[11px] text-ink-soft">{detail}</span>
      </div>
    </div>
  );
}

async function JournalEntryCard({
  supabase,
  title,
  journalEntryId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  title: string;
  journalEntryId: string;
}) {
  const [{ data: entry }, { data: postings }] = await Promise.all([
    supabase.from("journal_entries").select("memo, entry_date").eq("id", journalEntryId).maybeSingle(),
    supabase
      .from("ledger_postings")
      .select("account_code, direction, amount_kobo")
      .eq("journal_entry_id", journalEntryId)
      .order("direction", { ascending: false }),
  ]);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        <span className="text-[11px] text-ink-soft">{entry?.entry_date ?? "—"}</span>
      </div>
      {entry?.memo && <p className="mt-1 text-[12px] text-ink-soft">{entry.memo}</p>}
      <div className="mt-3 flex flex-col gap-1">
        {(postings ?? []).map((posting, i) => (
          <div key={i} className="flex items-center justify-between text-[12.5px]">
            <span className="text-ink-soft">
              {ACCOUNT_LABEL[posting.account_code] ?? posting.account_code}{" "}
              <span className="text-[10.5px] font-bold uppercase tracking-[0.03em]">
                ({posting.direction})
              </span>
            </span>
            <span className="font-bold text-ink">{formatKobo(BigInt(posting.amount_kobo))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: bill } = await supabase.from("vendor_bills").select("*, vendors(id, name)").eq("id", id).maybeSingle();
  if (!bill) notFound();

  const { data: lines } = await supabase
    .from("vendor_bill_lines")
    .select("id, description, quantity, unit_price_kobo, discount_kobo, line_total_kobo, sort_order")
    .eq("bill_id", id)
    .order("sort_order", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(bill.due_date && bill.due_date < today && bill.status !== "paid" && bill.status !== "cancelled");

  const timeline: { label: string; detail: string }[] = [
    { label: "Raised", detail: bill.created_at.slice(0, 10) },
  ];
  if (bill.status === "rejected") {
    timeline.push({ label: "Rejected", detail: bill.approved_at ? bill.approved_at.slice(0, 10) : "—" });
  } else if (bill.approved_at) {
    timeline.push({ label: "Approved", detail: bill.approved_at.slice(0, 10) });
  }
  if (bill.scheduled_payment_date) {
    timeline.push({ label: "Scheduled for payment", detail: bill.scheduled_payment_date });
  }
  if (bill.paid_at) {
    timeline.push({ label: "Paid", detail: bill.paid_at.slice(0, 10) });
  }
  if (bill.cancelled_at) {
    timeline.push({
      label: "Cancelled",
      detail: `${bill.cancelled_at.slice(0, 10)}${bill.cancellation_reason ? ` — ${bill.cancellation_reason}` : ""}`,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <Link href="/bills" className="w-fit text-[12.5px] font-bold text-primary">
        ← Back to bills
      </Link>

      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
          Bill {bill.bill_number ?? bill.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-extrabold text-ink">
            {bill.vendors?.name ? (
              <Link href={`/vendors/${bill.vendors.id}`} className="text-primary">
                {bill.vendors.name}
              </Link>
            ) : (
              "Unknown vendor"
            )}
          </h1>
          <VendorBillStatusBadge status={bill.status} />
          {overdue && <OverdueBadge />}
        </div>
        <p className="text-[13px] text-ink-soft">{bill.description}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Subtotal" value={formatKobo(BigInt(bill.subtotal_kobo))} />
        <SummaryTile label="VAT" value={formatKobo(BigInt(bill.vat_kobo))} />
        <SummaryTile label="WHT withheld" value={formatKobo(BigInt(bill.wht_kobo))} />
        <SummaryTile label="Net payable" value={formatKobo(BigInt(bill.net_payable_kobo))} />
        <SummaryTile label="Bill date" value={bill.bill_date} />
        <SummaryTile label="Due date" value={bill.due_date ?? "—"} />
        <SummaryTile label="VAT category" value={bill.vat_category ?? "—"} />
        <SummaryTile label="WHT category" value={bill.wht_category ?? "—"} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Line items</span>
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={`${thClass} text-left`}>Description</th>
                <th className={`${thClass} text-right`}>Qty</th>
                <th className={`${thClass} text-right`}>Unit price</th>
                <th className={`${thClass} text-right`}>Discount</th>
                <th className={`${thClass} text-right`}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {(lines ?? []).length > 0 ? (
                (lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{line.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{line.quantity}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(line.unit_price_kobo))}</td>
                    <td className={`${tdClass} text-right text-ink-soft`}>
                      {line.discount_kobo > 0 ? formatKobo(BigInt(line.discount_kobo)) : "—"}
                    </td>
                    <td className={`${tdClass} text-right font-bold text-ink`}>
                      {formatKobo(BigInt(line.line_total_kobo))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[13px] text-ink-soft">
                    No line items recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Timeline</span>
        <div className="flex flex-col gap-2">
          {timeline.map((step) => (
            <TimelineStep key={step.label} label={step.label} detail={step.detail} />
          ))}
        </div>
      </div>

      {(bill.journal_entry_id || bill.payment_journal_entry_id) && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Journal entries</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {bill.journal_entry_id && (
              <JournalEntryCard supabase={supabase} title="Approval posting" journalEntryId={bill.journal_entry_id} />
            )}
            {bill.payment_journal_entry_id && (
              <JournalEntryCard supabase={supabase} title="Payment posting" journalEntryId={bill.payment_journal_entry_id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
