import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { RecurringInvoiceForm } from "./RecurringInvoiceForm";
import { toggleRecurringInvoice, deleteRecurringInvoice } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export default async function RecurringInvoicesPage() {
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

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const [{ data: templates }, { data: customers }] = await Promise.all([
    supabase
      .from("customer_invoice_templates")
      .select("*, customers(name)")
      .order("active", { ascending: false })
      .order("next_invoice_date", { ascending: true }),
    supabase.from("customers").select("id, name").eq("status", "active").order("name"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
        <h1 className="text-[22px] font-extrabold text-ink">Recurring invoices</h1>
        <p className="text-[13px] text-ink-soft">
          A template raises a new draft invoice automatically on schedule — issuing it (recognizing the revenue) is
          still a deliberate step every time, never automated.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Customer</th>
              <th className={`${thClass} text-left`}>Description</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-left`}>Repeats</th>
              <th className={`${thClass} text-left`}>Next invoice date</th>
              <th className={`${thClass} text-center`}>Status</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <tr key={template.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{template.customers?.name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{template.description}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(template.amount_kobo))}</td>
                  <td className={`${tdClass} text-ink-soft`}>{CADENCE_LABEL[template.cadence] ?? template.cadence}</td>
                  <td className={`${tdClass} text-ink-soft`}>{template.next_invoice_date}</td>
                  <td className={`${tdClass} text-center`}>
                    {template.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-3">
                        <form action={toggleRecurringInvoice.bind(null, template.id, !template.active)}>
                          <FormSubmitButton className="text-[12px] font-bold text-primary">
                            {template.active ? "Pause" : "Resume"}
                          </FormSubmitButton>
                        </form>
                        <ConfirmActionButton
                          action={deleteRecurringInvoice.bind(null, template.id)}
                          label="Delete"
                          confirmTitle="Delete this recurring invoice?"
                          confirmMessage={`"${template.description}" for ${template.customers?.name ?? "this customer"} will stop generating new invoices. Invoices it already raised aren't affected.`}
                          confirmLabel="Delete"
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No recurring invoices set up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Set up a recurring invoice
          </span>
          <div className="mt-3">
            <RecurringInvoiceForm customers={customers ?? []} />
          </div>
        </div>
      )}

      <Link href="/invoices" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Invoices
      </Link>
    </div>
  );
}
