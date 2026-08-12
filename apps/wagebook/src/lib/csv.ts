// Shared with the two existing CSV export routes (payroll/[id]/export,
// reports/annual/export) — every CSV in this app quotes/escapes the same
// way, so a cell containing a comma, quote or newline round-trips
// correctly in Excel/Sheets/Numbers.
export function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const allRows = [headers, ...rows];
  return allRows.map((row) => row.map((cell) => csvField(String(cell))).join(",")).join("\r\n");
}
