import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { formatKobo } from "@/lib/format";
import { Badge } from "@/components/Badge";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { RecurringBillForm } from "./RecurringBillForm";
import { toggleRecurringBill, deleteRecurringBill } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const CADENCE_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export default async function RecurringBillsPage() {
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
    (membership.role !== "admin" && membership.role !== "payroll_manager" && membership.role !== "accountant")
  ) {
    redirect("/dashboard");
  }

  const canManage = membership.role === "admin" || membership.role === "payroll_manager";

  const [{ data: templates }, { data: vendors }] = await Promise.all([
    supabase
      .from("vendor_bill_templates")
      .select("*, vendors(name)")
      .order("active", { ascending: false })
      .order("next_bill_date", { ascending: true }),
    supabase.from("vendors").select("id, name").eq("status", "active").order("name"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
        <h1 className="text-[22px] font-extrabold text-ink">Recurring bills</h1>
        <p className="text-[13px] text-ink-soft">
          A template raises a new bill automatically on schedule, landing pending approval exactly like a
          manually-raised one — approving and paying it is still a deliberate step every time.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>Description</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-left`}>Repeats</th>
              <th className={`${thClass} text-left`}>Next bill date</th>
              <th className={`${thClass} text-center`}>Status</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <tr key={template.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{template.vendors?.name ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>{template.description}</td>
                  <td className={`${tdClass} text-right text-ink`}>{formatKobo(BigInt(template.amount_kobo))}</td>
                  <td className={`${tdClass} text-ink-soft`}>{CADENCE_LABEL[template.cadence] ?? template.cadence}</td>
                  <td className={`${tdClass} text-ink-soft`}>{template.next_bill_date}</td>
                  <td className={`${tdClass} text-center`}>
                    {template.active ? <Badge tone="good">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-3">
                        <form action={toggleRecurringBill.bind(null, template.id, !template.active)}>
                          <FormSubmitButton className="text-[12px] font-bold text-primary">
                            {template.active ? "Pause" : "Resume"}
                          </FormSubmitButton>
                        </form>
                        <ConfirmActionButton
                          action={deleteRecurringBill.bind(null, template.id)}
                          label="Delete"
                          confirmTitle="Delete this recurring bill?"
                          confirmMessage={`"${template.description}" for ${template.vendors?.name ?? "this vendor"} will stop generating new bills. Bills it already raised aren't affected.`}
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
                  No recurring bills set up yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Set up a recurring bill
          </span>
          <div className="mt-3">
            <RecurringBillForm vendors={vendors ?? []} />
          </div>
        </div>
      )}

      <Link href="/bills" className="w-fit text-[13px] font-bold text-primary">
        ← Back to Bills
      </Link>
    </div>
  );
}
