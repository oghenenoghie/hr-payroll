import { NextResponse } from "next/server";
import { toNaira } from "@plutus/compliance";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

// The "Direct Deposit & Payments" roadmap item's actual missing
// prerequisite — feature-modules.ts disclosed "still no bank disbursement
// file or transfer integration" even though feature-backlog.md's "Failed
// payment tracking" entry assumed one already existed. It didn't. This is
// a bookkeeper-facing CSV of who to pay, how much, and where — not any
// particular bank's official bulk-upload template (no such single
// Nigerian standard exists to target) and not a transfer integration
// (Paystack/bank API) that would actually move money. An employee missing
// any bank field is still listed, flagged, rather than silently dropped —
// net_pay_payable was already posted to the ledger for them regardless of
// whether they can actually be paid by transfer.
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
  if (!membership || !["admin", "payroll_manager", "finance_manager"].includes(membership.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: payRun } = await supabase
    .from("pay_runs")
    .select("id, period_start, period_end, status")
    .eq("id", id)
    .maybeSingle();

  if (!payRun) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (payRun.status === "draft" || payRun.status === "validated") {
    return new NextResponse("This pay run hasn't been locked yet", { status: 409 });
  }

  const { data: payslips } = await supabase
    .from("payslips")
    .select("net_kobo, employees(full_name, bank_name, bank_account_number, bank_account_name)")
    .eq("pay_run_id", id)
    .order("created_at", { ascending: true });

  const rows = [
    ["Employee", "Bank", "Account Number", "Account Name", "Amount (NGN)", "Narration", "Ready to Pay"],
    ...(payslips ?? [])
      .filter((slip) => BigInt(slip.net_kobo) > 0n)
      .map((slip) => {
        const employee = slip.employees;
        const hasBankDetails = Boolean(employee?.bank_name && employee?.bank_account_number && employee?.bank_account_name);
        return [
          employee?.full_name ?? "",
          employee?.bank_name ?? "",
          employee?.bank_account_number ?? "",
          employee?.bank_account_name ?? "",
          toNaira(BigInt(slip.net_kobo)).toFixed(2),
          `Salary ${payRun.period_start} - ${payRun.period_end}`,
          hasBankDetails ? "Yes" : "No — missing bank details",
        ];
      }),
  ];

  const csv = rows.map((row) => row.map((cell) => csvField(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="disbursement-${payRun.period_start}-to-${payRun.period_end}.csv"`,
    },
  });
}
