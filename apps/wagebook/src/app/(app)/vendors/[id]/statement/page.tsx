import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { toNaira } from "@plutus/compliance";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

type StatementLine = {
  date: string;
  label: string;
  billNumber: string | null;
  amountKobo: bigint;
  runningBalanceKobo: bigint;
};

export default async function VendorStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
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

  const [{ data: vendor }, { data: bills }] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("vendor_bills")
      .select("id, description, bill_number, amount_kobo, bill_date, due_date, status, approved_at, paid_at")
      .eq("vendor_id", id)
      .order("bill_date", { ascending: true }),
  ]);
  if (!vendor) notFound();

  // A bill only affects what's owed once it's actually posted to the
  // ledger: approval recognizes the liability (a debit-side event from
  // the vendor's perspective — the balance owed goes up), payment settles
  // it (balance owed goes down). A rejected bill or one still pending
  // approval never posted anything, so it's listed separately below
  // rather than folded into the running balance.
  const postedEvents: { date: string; label: string; billNumber: string | null; amountKobo: bigint }[] = [];
  for (const bill of bills ?? []) {
    if (bill.approved_at) {
      postedEvents.push({
        date: bill.approved_at,
        label: `Bill: ${bill.description}`,
        billNumber: bill.bill_number,
        amountKobo: BigInt(bill.amount_kobo),
      });
    }
    if (bill.paid_at) {
      postedEvents.push({
        date: bill.paid_at,
        label: `Payment: ${bill.description}`,
        billNumber: bill.bill_number,
        amountKobo: -BigInt(bill.amount_kobo),
      });
    }
  }
  postedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const fromTime = from ? Date.parse(from) : null;
  const toTime = to ? Date.parse(to) : null;

  // Running balance is computed over full history up to the period end
  // (or "now" if no end given) so a filtered statement still shows the
  // correct opening balance for the period — never a balance that resets
  // to zero at an arbitrary cutoff.
  let runningBalanceKobo = 0n;
  const lines: StatementLine[] = [];
  for (const event of postedEvents) {
    const eventTime = new Date(event.date).getTime();
    if (toTime !== null && eventTime > toTime + 86_400_000 - 1) continue;
    runningBalanceKobo += event.amountKobo;
    if (fromTime !== null && eventTime < fromTime) continue;
    lines.push({ ...event, runningBalanceKobo });
  }

  const unposted = (bills ?? []).filter((b) => b.status === "pending_approval" || b.status === "rejected");

  const csv = toCsv(
    ["Date", "Description", "Bill Number", "Amount (NGN)", "Running Balance (NGN)"],
    lines.map((line) => [
      line.date.slice(0, 10),
      line.label,
      line.billNumber ?? "",
      toNaira(line.amountKobo).toFixed(2),
      toNaira(line.runningBalanceKobo).toFixed(2),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
        <h1 className="text-[22px] font-extrabold text-ink">{vendor.name} — statement</h1>
        <p className="text-[13px] text-ink-soft">
          Every bill and payment posted for this vendor, with a running balance of what&apos;s owed. Only approved
          (liability recognized) and paid (liability settled) events affect the balance below.
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-control border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-control border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
        >
          Filter
        </button>
        {(from || to) && (
          <Link href={`/vendors/${id}/statement`} className="text-[12.5px] font-bold text-primary">
            Clear
          </Link>
        )}
        {lines.length > 0 && (
          <div className="ml-auto">
            <ExportCsvButton csv={csv} filename={`${vendor.name}-statement.csv`} label="Export (CSV)" />
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Date</th>
              <th className={`${thClass} text-left`}>Description</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-right`}>Balance owed</th>
            </tr>
          </thead>
          <tbody>
            {lines.length > 0 ? (
              lines.map((line, index) => (
                <tr key={index} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} text-ink-soft`}>{line.date.slice(0, 10)}</td>
                  <td className={`${tdClass} text-ink`}>
                    {line.label}
                    {line.billNumber ? ` (${line.billNumber})` : ""}
                  </td>
                  <td className={`${tdClass} text-right ${line.amountKobo < 0n ? "text-good" : "text-ink"}`}>
                    {line.amountKobo < 0n ? "-" : ""}
                    {formatKobo(line.amountKobo < 0n ? -line.amountKobo : line.amountKobo)}
                  </td>
                  <td className={`${tdClass} text-right font-bold text-ink`}>{formatKobo(line.runningBalanceKobo)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No posted bills or payments in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unposted.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Not yet posted (pending approval or rejected — excluded from the balance above)
          </span>
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className={`${thClass} text-left`}>Bill date</th>
                  <th className={`${thClass} text-left`}>Description</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-center`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {unposted.map((bill) => (
                  <tr key={bill.id} className="border-b border-border last:border-b-0">
                    <td className={`${tdClass} text-ink-soft`}>{bill.bill_date}</td>
                    <td className={`${tdClass} text-ink`}>{bill.description}</td>
                    <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(bill.amount_kobo))}</td>
                    <td className={`${tdClass} text-center`}>
                      <VendorBillStatusBadge status={bill.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link href="/vendors" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Vendors
      </Link>
    </div>
  );
}
