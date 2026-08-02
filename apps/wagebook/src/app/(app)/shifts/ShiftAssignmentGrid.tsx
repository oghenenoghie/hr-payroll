"use client";

import { useTransition } from "react";
import { setShiftAssignment } from "./actions";

type Employee = { id: string; full_name: string };
type ShiftTemplate = { id: string; name: string; start_time: string; end_time: string };

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-2 py-[6px] text-[13px]";

function ShiftCell({
  employeeId,
  date,
  shiftTemplateId,
  templates,
}: {
  employeeId: string;
  date: string;
  shiftTemplateId: string;
  templates: ShiftTemplate[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={shiftTemplateId}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(() => {
          setShiftAssignment(employeeId, date, next);
        });
      }}
      className="w-full rounded-control border border-border bg-surface px-2 py-1 text-[11px] font-bold text-ink outline-none focus:border-primary disabled:opacity-50"
    >
      <option value="">—</option>
      {templates.map((template) => (
        <option key={template.id} value={template.id}>
          {template.name}
        </option>
      ))}
    </select>
  );
}

export function ShiftAssignmentGrid({
  employees,
  dates,
  templates,
  assignmentsByKey,
}: {
  employees: Employee[];
  dates: string[];
  templates: ShiftTemplate[];
  assignmentsByKey: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={`${thClass} text-left`}>Employee</th>
            {dates.map((date) => (
              <th key={date} className={`${thClass} text-center`}>
                {new Date(date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <tr key={employee.id} className="border-b border-border last:border-b-0">
                <td className={`${tdClass} font-bold text-ink`}>{employee.full_name}</td>
                {dates.map((date) => (
                  <td key={date} className={`${tdClass} text-center`}>
                    <ShiftCell
                      employeeId={employee.id}
                      date={date}
                      shiftTemplateId={assignmentsByKey[`${employee.id}:${date}`] ?? ""}
                      templates={templates}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={dates.length + 1} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                No active employees.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
