"use client";

export function PrintButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-button bg-primary px-[18px] py-[9px] text-[12.5px] font-extrabold text-white"
    >
      {children}
    </button>
  );
}
