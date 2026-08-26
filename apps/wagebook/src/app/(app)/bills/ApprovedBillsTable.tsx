"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatKobo } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VendorBillStatusBadge, OverdueBadge } from "@/components/Badge";
import { useToast } from "@/components/Toast";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { Button } from "@/components/Button";
import { payVendorBillsBatch } from "./actions";
import { ScheduleBillPaymentForm } from "./ScheduleBillPaymentForm";
import { CancelBillForm } from "./CancelBillForm";

type ApprovedBill = {
  id: string;
  vendor_id: string;
  bill_number: string | null;
  description: string;
  amount_kobo: number;
  wht_kobo: number;
  net_payable_kobo: number;
  due_date: string | null;
  status: string;
  scheduled_payment_date: string | null;
  vendors: { name: string } | null;
};

// Select several bills — approved or already scheduled for payment,
// pay_vendor_bills_batch accepts either — and pay them together in one
// action — one aggregate journal entry for the whole batch, the same
// way a pay run posts once per run rather than once per employee —
// instead of clicking "mark as paid" on each bill individually.
export function ApprovedBillsTable({
  bills,
  canManage,
  today,
}: {
  bills: ApprovedBill[];
  canManage: boolean;
  today: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedBills = bills.filter((bill) => selected.has(bill.id));
  const totalKobo = selectedBills.reduce((sum, bill) => sum + BigInt(bill.amount_kobo), 0n);
  const totalWhtKobo = selectedBills.reduce((sum, bill) => sum + BigInt(bill.wht_kobo), 0n);
  const totalNetPayableKobo = selectedBills.reduce((sum, bill) => sum + BigInt(bill.net_payable_kobo), 0n);

  function runBatchPay() {
    setConfirming(false);
    const count = selected.size;
    startTransition(async () => {
      const result = await payVendorBillsBatch(Array.from(selected));
      setSelected(new Set());
      if (result?.error) {
        showToast(result.error, "bad");
      } else {
        showToast(`${count} bill${count === 1 ? "" : "s"} paid`, "good");
      }
    });
  }

  const columns: DataTableColumn<ApprovedBill>[] = [
    ...(canManage
      ? [
          {
            key: "select",
            header: "",
            render: (bill: ApprovedBill) => (
              <input
                type="checkbox"
                checked={selected.has(bill.id)}
                disabled={pending}
                onChange={() => toggle(bill.id)}
                className="h-4 w-4 accent-primary"
              />
            ),
          },
        ]
      : []),
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
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (bill) => bill.amount_kobo,
      render: (bill) => <span className="text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>,
    },
    {
      key: "wht",
      header: "WHT",
      align: "right",
      sortValue: (bill) => bill.wht_kobo,
      render: (bill) => <span className="text-ink-soft">{formatKobo(BigInt(bill.wht_kobo))}</span>,
    },
    {
      key: "net_payable",
      header: "Net payable",
      align: "right",
      sortValue: (bill) => bill.net_payable_kobo,
      render: (bill) => <span className="font-bold text-ink">{formatKobo(BigInt(bill.net_payable_kobo))}</span>,
    },
    {
      key: "due_date",
      header: "Due date",
      sortValue: (bill) => bill.due_date ?? "",
      render: (bill) => (
        <div className="flex items-center gap-1.5">
          <span className="text-ink-soft">{bill.due_date ?? "—"}</span>
          {Boolean(bill.due_date && bill.due_date < today) && <OverdueBadge />}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (bill) => (
        <div className="flex flex-col gap-1">
          <VendorBillStatusBadge status={bill.status} />
          {bill.scheduled_payment_date && (
            <span className="text-[11px] text-ink-soft">for {bill.scheduled_payment_date}</span>
          )}
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (bill: ApprovedBill) => (
              <div className="flex flex-col items-end gap-1.5">
                {bill.status === "approved" && <ScheduleBillPaymentForm billId={bill.id} />}
                <CancelBillForm billId={bill.id} billDescription={bill.description} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        rows={bills}
        rowKey={(bill) => bill.id}
        rowClassName={(bill) => (Boolean(bill.due_date && bill.due_date < today) ? "bg-bad-tint" : "")}
        renderCard={(bill) => {
          const overdue = Boolean(bill.due_date && bill.due_date < today);
          return (
            <div className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={selected.has(bill.id)}
                      disabled={pending}
                      onChange={() => toggle(bill.id)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                  )}
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
                </div>
                <div className="flex flex-col items-end gap-1">
                  <VendorBillStatusBadge status={bill.status} />
                  {bill.scheduled_payment_date && (
                    <span className="text-[10.5px] text-ink-soft">for {bill.scheduled_payment_date}</span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-ink-soft">{bill.description}</p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
                <span className="flex items-center gap-1.5">
                  Due {bill.due_date ?? "—"}
                  {overdue && <OverdueBadge />}
                </span>
                <span>{formatKobo(BigInt(bill.amount_kobo))}</span>
              </div>
              {canManage && (
                <div className="mt-3 flex items-center justify-end gap-3 border-t border-border pt-3">
                  {bill.status === "approved" && <ScheduleBillPaymentForm billId={bill.id} />}
                  <CancelBillForm billId={bill.id} billDescription={bill.description} />
                </div>
              )}
            </div>
          );
        }}
      />

      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-[13px] font-bold text-ink">
            {selected.size} bill{selected.size === 1 ? "" : "s"} selected · {formatKobo(totalKobo)}
            {totalWhtKobo > 0n && <span className="text-ink-soft"> · {formatKobo(totalNetPayableKobo)} net after WHT</span>}
          </span>
          <Button type="button" disabled={pending} onClick={() => setConfirming(true)} size="md">
            {pending ? "Paying…" : "Pay selected"}
          </Button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Pay the selected bills?"
          message={
            totalWhtKobo > 0n
              ? `${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will be marked paid in one batch: Accounts Payable is debited for the full amount, Cash & Bank is credited ${formatKobo(totalNetPayableKobo)}, and WHT Payable is credited ${formatKobo(totalWhtKobo)} to remit separately — all in one balanced journal entry.`
              : `${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will be marked paid in one batch, debiting Accounts Payable and crediting Cash & Bank in a single journal entry.`
          }
          confirmLabel="Pay bills"
          tone="primary"
          onConfirm={runBatchPay}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
