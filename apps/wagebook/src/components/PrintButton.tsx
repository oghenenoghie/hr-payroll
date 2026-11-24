"use client";

export function PrintButton({ children }: { children: React.ReactNode }) {
  function handlePrint() {
    // The page displaying this control is the document preview. Do not open
    // the native print dialog until the user has reviewed the document and
    // explicitly activates this button.
    window.focus();
    window.print();
  }

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <span className="text-right text-[11px] text-ink-soft">
        Preview the document below before printing.
      </span>
      <button
        type="button"
        onClick={handlePrint}
        aria-label="Print document or save as PDF"
        className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
      >
        {children}
      </button>
    </div>
  );
}
