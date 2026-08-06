import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { TinBadge } from "@/components/Badge";
import { VendorForm } from "./VendorForm";
import { deleteVendor } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

const MANAGE_ROLES = ["admin", "payroll_manager", "accountant"];
const VIEW_ROLES = [...MANAGE_ROLES, "auditor"];

export default async function VendorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || !VIEW_ROLES.includes(membership.role)) {
    redirect("/dashboard");
  }

  const canManage = MANAGE_ROLES.includes(membership.role);

  const { data: vendors } = await supabase.from("vendors").select("*").order("name");

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Vendors</span>
        <h1 className="text-[22px] font-extrabold text-ink">Vendor catalog for invoicing</h1>
        <p className="text-[13px] text-ink-soft">
          Vendors billed for goods or services. Add one here, then raise a vendor invoice with VAT and WHT computed
          automatically.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Vendor</th>
              <th className={`${thClass} text-left`}>TIN</th>
              <th className={`${thClass} text-left`}>Email</th>
              <th className={`${thClass} text-left`}>Bank</th>
              {canManage && <th className={thClass}></th>}
            </tr>
          </thead>
          <tbody>
            {vendors && vendors.length > 0 ? (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{vendor.name}</td>
                  <td className={tdClass}>
                    <TinBadge tin={vendor.tin} />
                  </td>
                  <td className={`${tdClass} text-ink-soft`}>{vendor.email ?? "—"}</td>
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
                <td colSpan={canManage ? 5 : 4} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-card border border-border bg-surface p-6">
          <VendorForm />
        </div>
      )}
    </div>
  );
}
