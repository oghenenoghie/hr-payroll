"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/notifications";

async function notifyLoanDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loanId: string,
  decision: "approved" | "rejected",
) {
  const { data: loan } = await supabase
    .from("loans")
    .select("org_id, employees(user_id)")
    .eq("id", loanId)
    .maybeSingle();

  if (!loan?.employees?.user_id) return;

  await notifyUsers(supabase, {
    orgId: loan.org_id,
    recipientUserIds: [loan.employees.user_id],
    type: decision === "approved" ? "loan_approved" : "loan_rejected",
    message:
      decision === "approved" ? "Your loan request was approved." : "Your loan request was rejected.",
    link: "/me",
  });
}

export async function approveLoan(loanId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // review_loan() only actually finalizes on the last approval step (a
  // multi-step workflow's intermediate approvals leave status 'pending')
  // — only notify the employee once it's genuinely decided, not on
  // every step along the way.
  const { data: loan } = await supabase.rpc("review_loan", { p_loan_id: loanId, p_approve: true });

  if (loan?.status === "approved") {
    await notifyLoanDecision(supabase, loanId, "approved");
  }

  revalidatePath("/loans");
}

export async function rejectLoan(loanId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("review_loan", { p_loan_id: loanId, p_approve: false });

  await notifyLoanDecision(supabase, loanId, "rejected");

  revalidatePath("/loans");
}
