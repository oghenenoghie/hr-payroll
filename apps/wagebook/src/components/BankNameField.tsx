"use client";

import { useState } from "react";
import { NUBAN_BANKS } from "@plutus/compliance";

const OTHER_VALUE = "__other__";
const selectClass =
  "w-full rounded-control border border-border bg-surface px-[13px] py-[11px] text-[13px] text-ink outline-none focus:border-primary";

/**
 * Bank name entry as a picker over Plutus's curated CBN-code list, so a
 * selected bank can be checksum-validated against its NUBAN. "Other" falls
 * back to free text for any institution not in the curated list — the
 * server still enforces the 10-digit format, just not the checksum, since
 * there's no bank code to validate against.
 */
export function BankNameField({ defaultValue }: { defaultValue: string }) {
  const matched = NUBAN_BANKS.some((bank) => bank.name === defaultValue);
  const [selected, setSelected] = useState(defaultValue === "" ? "" : matched ? defaultValue : OTHER_VALUE);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft" htmlFor="bank_name_select">
        Bank name
      </label>
      <select
        id="bank_name_select"
        name={selected === OTHER_VALUE ? "bank_name_select" : "bank_name"}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        className={selectClass}
      >
        <option value="">No bank on file</option>
        {NUBAN_BANKS.map((bank) => (
          <option key={bank.code} value={bank.name}>
            {bank.name}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other (not listed)</option>
      </select>
      {selected === OTHER_VALUE && (
        <input
          type="text"
          name="bank_name"
          defaultValue={matched ? "" : defaultValue}
          placeholder="Bank name"
          className={selectClass}
        />
      )}
    </div>
  );
}
