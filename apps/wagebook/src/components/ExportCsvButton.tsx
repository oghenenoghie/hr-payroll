"use client";

// The CSV string itself is always built server-side (see lib/csv.ts) from
// whatever the page already queried and rendered — this component's only
// job is triggering the browser download, so there's no risk of the
// export ever showing different numbers than the table above it.
export function ExportCsvButton({
  csv,
  filename,
  label = "Export CSV",
}: {
  csv: string;
  filename: string;
  label?: string;
}) {
  function handleClick() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-button border border-border px-[18px] py-[9px] text-[12.5px] font-extrabold text-ink"
    >
      {label}
    </button>
  );
}
