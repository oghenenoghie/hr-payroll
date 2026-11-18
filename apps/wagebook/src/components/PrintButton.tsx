"use client";

export function PrintButton({ children }: { children: React.ReactNode }) {
  function handlePrint() {
    // Focus the document before opening the native print dialog. This matters
    // in mobile browsers and embedded browser windows where print() on an
    // unfocused document can be ignored.
    window.focus();
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      aria-label="Print payslip or save as PDF"
      className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
    >
      {children}
    </button>
  );
}
