"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";

// Deliberately narrow: only flips status/paid_at (matches the RLS policy's
// own with-check, which forbids touching amount_kobo — that figure is
// fixed at issue time from the metered period it belongs to). There is no
// real payment gateway wired up here; this simply records that payment
// was received through some outside channel (bank transfer, etc.).
export async function markInvoicePaid(invoiceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role !== "admin") {
    return;
  }

  await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoiceId);

  revalidatePath("/billing");
}
