import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { AttendanceGrid } from "./AttendanceGrid";

function mondayOf(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (membership?.role === "employee") {
    redirect("/me");
  }

  const { week } = await searchParams;
  const requestedMonday = week && !Number.isNaN(Date.parse(week)) ? new Date(week) : new Date();
  const weekStart = mondayOf(requestedMonday);
  const weekEnd = addDays(weekStart, 6);
  const dates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");

  const { data: records } = await supabase
    .from("attendance_records")
    .select("employee_id, date, status")
    .gte("date", dates[0])
    .lte("date", dates[6]);

  const recordsByKey: Record<string, string> = {};
  for (const record of records ?? []) {
    recordsByKey[`${record.employee_id}:${record.date}`] = record.status;
  }

  const prevWeek = toISODate(addDays(weekStart, -7));
  const nextWeek = toISODate(addDays(weekStart, 7));

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Attendance</span>
        <h1 className="text-[22px] font-extrabold text-ink">Weekly attendance feeding straight into payroll deductions</h1>
        <p className="text-[13px] text-ink-soft">
          Click a cell to cycle Present → Late → Absent. Only Absent reduces pay — it&apos;s deducted automatically
          in the next pay run, the same way approved unpaid leave is.
        </p>
      </header>

      <div className="flex items-center justify-between">
        <Link href={`/attendance?week=${prevWeek}`} className="text-[12px] font-bold text-primary">
          ← Previous week
        </Link>
        <span className="text-[13px] font-bold text-ink">
          {toISODate(weekStart)} – {toISODate(weekEnd)}
        </span>
        <Link href={`/attendance?week=${nextWeek}`} className="text-[12px] font-bold text-primary">
          Next week →
        </Link>
      </div>

      <AttendanceGrid employees={employees ?? []} dates={dates} recordsByKey={recordsByKey} />
    </div>
  );
}
