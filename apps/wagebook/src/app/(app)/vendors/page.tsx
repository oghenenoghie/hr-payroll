import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { toCsv } from "@/lib/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { VendorForm } from "./VendorForm";
import { deleteVendor } from "./actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const PAGE_SIZE = 50;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const {
    data: vendors,
    count,
  } = await supabase
    .from("vendors")
    .select("*", { count: "exact" })
    .order("name")
    .range((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE - 1);

  const totalVendors = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalVendors / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  function pageHref(page: number): string {
    return `/vendors?page=${page}`;
  }

  const csv = toCsv(
    ["Vendor", "Contact Email", "Contact Phone", "Bank Name", "Bank Account Number", "Bank Account Name", "Status"],
    (vendors ?? []).map((vendor) => [
      vendor.name,
      vendor.contact_email ?? "",
      vendor.contact_phone ?? "",
      vendor.bank_name ?? "",
      vendor.bank_account_number ?? "",
      vendor.bank_account_name ?? "",
      vendor.status,
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Accounts Payable</span>
          {vendors && vendors.length > 0 && (
            <ExportCsvButton csv={csv} filename="vendors.csv" label="Export this page (CSV)" />
          )}
        </div>
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
              <th className={thClass}></th>
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
                  <td className={`${tdClass} text-right`}>
                    <Link href={`/vendors/${vendor.id}/statement`} className="font-bold text-primary">
                      Statement
                    </Link>
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <ConfirmActionButton
                        action={deleteVendor.bind(null, vendor.id)}
                        label="Delete"
                        confirmTitle="Delete this vendor?"
                        confirmMessage={`"${vendor.name}" will be removed. This can't be undone.`}
                        confirmLabel="Delete"
                      />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-soft">
            Page {currentPage} of {totalPages} · {totalVendors} vendor{totalVendors === 1 ? "" : "s"} total
          </span>
          <div className="flex gap-3">
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)} className="text-[12.5px] font-bold text-primary">
                ← Previous
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">← Previous</span>
            )}
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)} className="text-[12.5px] font-bold text-primary">
                Next →
              </Link>
            ) : (
              <span className="text-[12.5px] font-bold text-ink-soft">Next →</span>
            )}
          </div>
        </div>
      )}

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
