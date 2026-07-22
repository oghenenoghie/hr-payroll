import { EmployeeForm } from "./EmployeeForm";

export default function NewEmployeePage() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Employees</span>
        <h1 className="text-[22px] font-extrabold text-ink">Add employee</h1>
      </header>
      <div className="rounded-card border border-border bg-surface p-6">
        <EmployeeForm />
      </div>
    </div>
  );
}
