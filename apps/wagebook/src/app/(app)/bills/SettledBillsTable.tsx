"use client";

import Link from "next/link";
import { formatKobo } from "@/lib/format";
import { VendorBillStatusBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

type SettledBill = {
  id: string;
  vendor_id: string;
  bill_number: string | null;
  description: string;
  amount_kobo: number;
  status: string;
  bill_date: string;
  vendors: { name: string } | null;
};

export function SettledBillsTable({ bills, emptyMessage }: { bills: SettledBill[]; emptyMessage: string }) {
  const columns: DataTableColumn<SettledBill>[] = [
    {
      key: "bill_number",
      header: "Bill #",
      sortValue: (bill) => bill.bill_number ?? "",
      render: (bill) => (
        <Link href={`/bills/${bill.id}`} className="text-primary">
          {bill.bill_number ?? "View"}
        </Link>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      sortValue: (bill) => bill.vendors?.name ?? "",
      render: (bill) =>
        bill.vendors?.name ? (
          <Link href={`/vendors/${bill.vendor_id}`} className="font-bold text-primary">
            {bill.vendors.name}
          </Link>
        ) : (
          <span className="font-bold">—</span>
        ),
    },
    {
      key: "description",
      header: "Description",
      render: (bill) => <span className="text-ink-soft">{bill.description}</span>,
    },
    {
      key: "bill_date",
      header: "Bill date",
      sortValue: (bill) => bill.bill_date,
      render: (bill) => <span className="text-ink-soft">{bill.bill_date}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (bill) => bill.amount_kobo,
      render: (bill) => <span className="text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (bill) => <VendorBillStatusBadge status={bill.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={bills}
      rowKey={(bill) => bill.id}
      emptyMessage={emptyMessage}
      renderCard={(bill) => (
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <Link href={`/bills/${bill.id}`} className="text-[13px] font-bold text-primary">
                {bill.bill_number ?? "View"}
              </Link>
              {bill.vendors?.name ? (
                <Link href={`/vendors/${bill.vendor_id}`} className="text-[12.5px] font-bold text-ink">
                  {bill.vendors.name}
                </Link>
              ) : (
                <span className="text-[12.5px] font-bold text-ink">—</span>
              )}
            </div>
            <VendorBillStatusBadge status={bill.status} />
          </div>
          <p className="mt-2 text-[12.5px] text-ink-soft">{bill.description}</p>
          <div className="mt-2 flex items-center justify-between text-[12.5px]">
            <span className="text-ink-soft">{bill.bill_date}</span>
            <span className="font-bold text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>
          </div>
        </div>
      )}
    />
  );
}
