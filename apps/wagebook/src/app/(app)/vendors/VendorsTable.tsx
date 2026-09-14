"use client";

import Link from "next/link";
import type { Tables } from "@plutus/core";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { TinBadge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { deleteVendor } from "./actions";

// Split out from page.tsx (a Server Component) because DataTable's columns
// carry render/sortValue functions, which can't be serialized across the
// server/client boundary — see EmployeesTable.tsx for the same note.
export function VendorsTable({ vendors, canManage }: { vendors: Tables<"vendors">[]; canManage: boolean }) {
  const columns: DataTableColumn<Tables<"vendors">>[] = [
    {
      key: "name",
      header: "Vendor",
      sortValue: (vendor) => vendor.name,
      render: (vendor) => (
        <Link href={`/vendors/${vendor.id}`} className="font-bold text-primary">
          {vendor.name}
        </Link>
      ),
    },
    {
      key: "tin",
      header: "TIN",
      render: (vendor) => <TinBadge tin={vendor.tin} />,
    },
    {
      key: "contact",
      header: "Contact",
      render: (vendor) => (
        <span className="text-ink-soft">{vendor.contact_email ?? vendor.contact_phone ?? "—"}</span>
      ),
    },
    {
      key: "bank",
      header: "Bank details",
      render: (vendor) => (
        <span className="text-ink-soft">
          {vendor.bank_name ? `${vendor.bank_name} · ${vendor.bank_account_number ?? "—"}` : "—"}
        </span>
      ),
    },
    {
      key: "statement",
      header: "",
      align: "right",
      render: (vendor) => (
        <Link href={`/vendors/${vendor.id}/statement`} className="font-bold text-primary">
          Statement
        </Link>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            render: (vendor: Tables<"vendors">) => (
              <ConfirmActionButton
                action={deleteVendor.bind(null, vendor.id)}
                label="Delete"
                confirmTitle="Delete this vendor?"
                confirmMessage={`"${vendor.name}" will be removed. This can't be undone.`}
                confirmLabel="Delete"
              />
            ),
          },
        ]
      : []),
  ];

  return <DataTable columns={columns} rows={vendors} rowKey={(vendor) => vendor.id} emptyMessage="No vendors yet." />;
}
