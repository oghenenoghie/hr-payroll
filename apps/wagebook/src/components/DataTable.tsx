"use client";

import { useMemo, useState } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
};

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";
const ALIGN_CLASS = { left: "text-left", right: "text-right", center: "text-center" } as const;

// A shared sortable table shell — client-side sort over whatever rows the
// server already fetched (a page's worth, not the full unbounded set), so
// a column header click never issues a new request. Columns without a
// sortValue render but simply aren't clickable, rather than every column
// being forced to define one.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nothing to show.",
  defaultSortKey,
  renderCard,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  defaultSortKey?: string;
  // Optional stacked-card rendering for narrow viewports — a dense
  // multi-column table doesn't reflow into something readable on a
  // phone by itself, so below md this replaces the table wholesale
  // rather than making it scroll horizontally. Omit to keep the table
  // as the only rendering (horizontal scroll) at every width.
  renderCard?: (row: T) => React.ReactNode;
}) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    const withValues = rows.map((row) => ({ row, value: column.sortValue!(row) }));
    withValues.sort((a, b) => {
      if (a.value < b.value) return sortDir === "asc" ? -1 : 1;
      if (a.value > b.value) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return withValues.map((w) => w.row);
  }, [rows, columns, sortKey, sortDir]);

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(column.key);
      setSortDir("asc");
    }
  }

  return (
    <>
      {renderCard && (
        <div className="flex flex-col gap-2 md:hidden">
          {sortedRows.length > 0 ? (
            sortedRows.map((row) => <div key={rowKey(row)}>{renderCard(row)}</div>)
          ) : (
            <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
      <div className={`overflow-x-auto rounded-card border border-border bg-surface ${renderCard ? "hidden md:block" : ""}`}>
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th key={column.key} className={`${thClass} ${ALIGN_CLASS[column.align ?? "left"]}`}>
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {column.header}
                      {sortKey === column.key && <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-border last:border-b-0">
                  {columns.map((column) => (
                    <td key={column.key} className={`${tdClass} ${ALIGN_CLASS[column.align ?? "left"]}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
