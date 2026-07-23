"use client";

import { cycleAttendance } from "./actions";

const STATUS_LABEL: Record<string, string> = { present: "Present", late: "Late", absent: "Absent" };
const STATUS_CLASS: Record<string, string> = {
  present: "text-ink-soft",
  late: "bg-warn-tint text-warn",
  absent: "bg-bad-tint text-bad",
};

type Employee = { id: string; full_name: string };

export function AttendanceGrid({
  employees,
  dates,
  recordsByKey,
}: {
  employees: Employee[];
  dates: string[];
  recordsByKey: Record<string, string>;
}) {
  const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
  const tdClass = "px-2 py-[6px] text-[13px]";

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
                {dates.map((date) => {
                  const status = recordsByKey[`${employee.id}:${date}`] ?? "present";
                  return (
                    <td key={date} className={`${tdClass} text-center`}>
                      <form action={cycleAttendance.bind(null, employee.id, date, status)}>
                        <button
                          type="submit"
                          className={`w-full rounded-control px-2 py-1 text-[11px] font-bold uppercase tracking-[0.02em] ${STATUS_CLASS[status]}`}
                        >
                          {STATUS_LABEL[status]}
                        </button>
                      </form>
                    </td>
                  );
                })}
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
