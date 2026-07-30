import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { VendorForm } from "./VendorForm";
import { deleteVendor } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function VendorsPage() {
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

  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
        <h1 className="text-[22px] font-extrabold text-ink">Vendors</h1>
        <p className="text-[13px] text-ink-soft">
          Suppliers you owe bills to. Add a vendor here first, then raise bills against them from{" "}
          <a href="/bills" className="font-bold text-primary">
            Bills
          </a>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>Contact</th>
              <th className={`${thClass} text-left`}>Bank details</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {vendors && vendors.length > 0 ? (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{vendor.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>{vendor.contact_email ?? vendor.contact_phone ?? "—"}</td>
                  <td className={`${tdClass} text-ink-soft`}>
                    {vendor.bank_name ? `${vendor.bank_name} · ${vendor.bank_account_number ?? "—"}` : "—"}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <form action={deleteVendor.bind(null, vendor.id)}>
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
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Add a vendor</span>
          <div className="mt-3">
            <VendorForm />
          </div>
        </div>
      )}
    </div>
  );
}
