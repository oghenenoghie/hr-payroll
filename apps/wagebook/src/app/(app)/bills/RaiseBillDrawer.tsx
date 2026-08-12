"use client";

import { useState } from "react";
import { Drawer } from "@/components/Drawer";
import { BillForm } from "./BillForm";

type Vendor = { id: string; name: string };

// Raising a bill moves into a slide-over rather than a permanently
// inline card at the foot of the page — the same "add without leaving
// the list" shape a Drawer exists for. autoOpen covers the one deep link
// into this ("Raise a bill" from a vendor's own page, prefilled with
// that vendor) — that flow used to rely on a #raise-bill anchor scrolling
// to an always-visible card, which no longer applies once the form only
// renders inside the drawer.
export function RaiseBillDrawer({
  vendors,
  defaultVendorId,
  autoOpen,
}: {
  vendors: Vendor[];
  defaultVendorId?: string;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
      >
        Raise a bill
      </button>
      {open && (
        <Drawer title="Raise a bill" onClose={() => setOpen(false)}>
          <BillForm vendors={vendors} defaultVendorId={defaultVendorId} />
        </Drawer>
      )}
    </>
  );
}
