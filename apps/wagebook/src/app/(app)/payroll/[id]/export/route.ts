import { NextResponse } from "next/server";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { ACCOUNT_LABEL } from "@/lib/accounts";

// A real general-ledger CSV, not a demo — every figure comes straight from
// the ledger_postings this pay run already wrote (see create_pay_run and
// packages/compliance's double-entry model), so this file always
// reconciles to the run's own gross/net totals. No accounting-software API
// sync yet (QuickBooks/Xero/Sage) — that's still Roadmap; this is a manual
// CSV a bookkeeper imports.
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "payroll_manager")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: payRun } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end")
    .eq("id", id)
    .maybeSingle();

  if (!payRun) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: journalEntry } = await supabase
    .from("journal_entries")
    .select("id, entry_date, memo")
    .eq("pay_run_id", id)
    .maybeSingle();

  if (!journalEntry) {
    return new NextResponse("No journal entry for this pay run", { status: 404 });
  }

  const { data: postings } = await supabase
    .from("ledger_postings")
    .select("account_code, direction, amount_kobo, employees(full_name, departments(name))")
    .eq("journal_entry_id", journalEntry.id)
    .order("account_code");

  const rows = [
    ["Date", "Journal Memo", "Account Code", "Account Name", "Employee", "Department (Cost Centre)", "Debit (NGN)", "Credit (NGN)"],
    ...(postings ?? []).map((posting) => {
      const amountNaira = toNaira(BigInt(posting.amount_kobo)).toFixed(2);
      return [
        journalEntry.entry_date,
        journalEntry.memo,
        posting.account_code,
        ACCOUNT_LABEL[posting.account_code] ?? posting.account_code,
        posting.employees?.full_name ?? "",
        posting.employees?.departments?.name ?? "",
        posting.direction === "debit" ? amountNaira : "",
        posting.direction === "credit" ? amountNaira : "",
      ];
    }),
  ];

  const csv = rows.map((row) => row.map((cell) => csvField(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${payRun.period_start}-to-${payRun.period_end}.csv"`,
    },
  });
}
