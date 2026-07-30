import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CustomerForm } from "./CustomerForm";
import { deleteCustomer } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function CustomersPage() {
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

  const { data: customers } = await supabase.from("customers").select("*").order("name");

  const csv = toCsv(
    ["Customer", "Contact Email", "Contact Phone", "Billing Address", "Status"],
    (customers ?? []).map((customer) => [
      customer.name,
      customer.contact_email ?? "",
      customer.contact_phone ?? "",
      customer.billing_address ?? "",
      customer.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Receivable</span>
          {customers && customers.length > 0 && <ExportCsvButton csv={csv} filename="customers.csv" />}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Customers</h1>
        <p className="text-[13px] text-ink-soft">
          Who you invoice. Add a customer here first, then raise invoices against them from{" "}
          <Link href="/invoices" className="font-bold text-primary">
            Invoices
          </Link>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Customer</th>
              <th className={`${thClass} text-left`}>Contact</th>
              <th className={`${thClass} text-left`}>Billing address</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {customers && customers.length > 0 ? (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{customer.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>
                    {customer.contact_email ?? customer.contact_phone ?? "—"}
                  </td>
                  <td className={`${tdClass} text-ink-soft`}>{customer.billing_address ?? "—"}</td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <form action={deleteCustomer.bind(null, customer.id)}>
                        <button type="submit" className="text-[12px] font-bold text-bad">
                          Delete
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a customer</span>
          <div className="mt-3">
            <CustomerForm />
          </div>
        </div>
      )}
    </div>
  );
}
