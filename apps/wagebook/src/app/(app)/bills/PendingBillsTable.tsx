"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatKobo, getPendingAgeTone } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { approveVendorBill, rejectVendorBill, approveVendorBillsBatch, rejectVendorBillsBatch } from "./actions";

type PendingBill = {
  id: string;
  vendor_id: string;
  bill_number: string | null;
  description: string;
  amount_kobo: number;
  wht_kobo: number;
  net_payable_kobo: number;
  bill_date: string;
  created_at: string;
  vendors: { name: string } | null;
};

export function PendingBillsTable({ bills, canManage }: { bills: PendingBill[]; canManage: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
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

  function runBatch(kind: "approve" | "reject") {
    setConfirming(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await (kind === "approve" ? approveVendorBillsBatch(ids) : rejectVendorBillsBatch(ids));
      setSelected(new Set());
      const verb = kind === "approve" ? "approved" : "rejected";
      if (result.errors.length === 0) {
        showToast(`${result.succeededCount} bill${result.succeededCount === 1 ? "" : "s"} ${verb}`, "good");
      } else if (result.succeededCount === 0) {
        showToast(result.errors[0], "bad");
      } else {
        showToast(
          `${result.succeededCount} bill${result.succeededCount === 1 ? "" : "s"} ${verb}, ${result.errors.length} failed: ${result.errors[0]}`,
          "bad",
        );
      }
    });
  }

  async function approveOne(bill: PendingBill) {
    const result = await approveVendorBill(bill.id);
    if (result?.error) {
      showToast(result.error, "bad");
    } else {
      showToast("Bill approved", "good");
    }
  }

  async function rejectOne(bill: PendingBill) {
    const result = await rejectVendorBill(bill.id);
    if (result?.error) {
      showToast(result.error, "bad");
    } else {
      showToast("Bill rejected", "good");
    }
  }

  const columns: DataTableColumn<PendingBill>[] = [
    ...(canManage
      ? [
          {
            key: "select",
            header: "",
            render: (bill: PendingBill) => (
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
      key: "bill_date",
      header: "Bill date",
      sortValue: (bill) => bill.bill_date,
      render: (bill) => <span className="text-ink-soft">{bill.bill_date}</span>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (bill: PendingBill) => (
              <div className="flex justify-end gap-2">
                <ConfirmActionButton
                  action={() => approveOne(bill)}
                  label="Approve"
                  variant="row"
                  confirmTitle="Approve this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} (${formatKobo(BigInt(bill.amount_kobo))}) will be approved. If this org has a multi-step chain configured for bills, this may only advance it to the next step rather than fully approving it.`}
                  confirmLabel="Approve"
                />
                <ConfirmActionButton
                  action={() => rejectOne(bill)}
                  label="Reject"
                  confirmTitle="Reject this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} will be rejected.`}
                  confirmLabel="Reject"
                />
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
        rowClassName={(bill) => (getPendingAgeTone(bill.created_at) === "warn" ? "bg-warn-tint" : "")}
        renderCard={(bill) => (
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
              <span className="text-[12.5px] font-bold text-ink">{formatKobo(BigInt(bill.amount_kobo))}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-ink-soft">{bill.description}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-ink-soft">
              <span>{bill.bill_date}</span>
              <span>Net {formatKobo(BigInt(bill.net_payable_kobo))}</span>
            </div>
            {canManage && (
              <div className="mt-3 flex justify-end gap-3 border-t border-border pt-3">
                <ConfirmActionButton
                  action={() => approveOne(bill)}
                  label="Approve"
                  variant="row"
                  confirmTitle="Approve this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} (${formatKobo(BigInt(bill.amount_kobo))}) will be approved. If this org has a multi-step chain configured for bills, this may only advance it to the next step rather than fully approving it.`}
                  confirmLabel="Approve"
                />
                <ConfirmActionButton
                  action={() => rejectOne(bill)}
                  label="Reject"
                  confirmTitle="Reject this bill?"
                  confirmMessage={`"${bill.description}" from ${bill.vendors?.name ?? "this vendor"} will be rejected.`}
                  confirmLabel="Reject"
                />
              </div>
            )}
          </div>
        )}
      />

      {canManage && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-[13px] font-bold text-ink">
            {selected.size} bill{selected.size === 1 ? "" : "s"} selected · {formatKobo(totalKobo)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="danger" size="md" disabled={pending} onClick={() => setConfirming("reject")}>
              {pending ? "Working…" : "Reject selected"}
            </Button>
            <Button type="button" size="md" disabled={pending} onClick={() => setConfirming("approve")}>
              {pending ? "Working…" : "Approve selected"}
            </Button>
          </div>
        </div>
      )}

      {confirming === "approve" && (
        <ConfirmDialog
          title="Approve the selected bills?"
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will each be approved individually. A bill on a multi-step chain may only advance rather than fully approve.`}
          confirmLabel="Approve bills"
          tone="primary"
          onConfirm={() => runBatch("approve")}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "reject" && (
        <ConfirmDialog
          title="Reject the selected bills?"
          message={`${selected.size} bill${selected.size === 1 ? "" : "s"} totalling ${formatKobo(totalKobo)} will be rejected. This can't be undone from here — a rejected bill would need to be raised again.`}
          confirmLabel="Reject bills"
          onConfirm={() => runBatch("reject")}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
