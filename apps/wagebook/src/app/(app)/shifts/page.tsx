import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { ShiftAssignmentGrid } from "./ShiftAssignmentGrid";

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

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  const isManagingRole =
    membership.role === "admin" || membership.role === "hr_manager" || membership.role === "department_manager";
  const isDepartmentManager = membership.role === "department_manager";
  const isHrOrAdmin = membership.role === "admin" || membership.role === "hr_manager";

  const { week } = await searchParams;
  const requestedMonday = week && !Number.isNaN(Date.parse(week)) ? new Date(week) : new Date();
  const weekStart = mondayOf(requestedMonday);
  const dates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const prevWeek = toISODate(addDays(weekStart, -7));
  const nextWeek = toISODate(addDays(weekStart, 7));

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("id, department_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Everyone with an employee record sees their own upcoming shifts,
  // regardless of role — self-service, matching Performance Management's
  // "my goals" and Recruitment's "your interviews" shape.
  const today = toISODate(new Date());
  const { data: myShiftsRaw } = myEmployee
    ? await supabase
        .from("shift_assignments")
        .select("date, shift_templates(name, start_time, end_time)")
        .eq("employee_id", myEmployee.id)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(14)
    : { data: null };
  const myShifts = myShiftsRaw ?? [];

  let roster: { id: string; full_name: string }[] = [];
  let templates: { id: string; name: string; start_time: string; end_time: string }[] = [];
  let assignmentsByKey: Record<string, string> = {};

  if (isManagingRole) {
    const [{ data: rosterRaw }, { data: templatesRaw }] = await Promise.all([
      isDepartmentManager && myEmployee?.department_id
        ? supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .eq("department_id", myEmployee.department_id)
            .order("full_name")
        : supabase
            .from("employees")
            .select("id, full_name")
            .eq("org_id", membership.orgId)
            .eq("status", "active")
            .order("full_name"),
      supabase.from("shift_templates").select("id, name, start_time, end_time").order("start_time"),
    ]);

    roster = rosterRaw ?? [];
    templates = templatesRaw ?? [];

    const rosterIds = roster.map((r) => r.id);
    const { data: assignments } =
      rosterIds.length > 0
        ? await supabase
            .from("shift_assignments")
            .select("employee_id, date, shift_template_id")
            .in("employee_id", rosterIds)
            .gte("date", dates[0])
            .lte("date", dates[6])
        : { data: null };

    assignmentsByKey = Object.fromEntries(
      (assignments ?? []).map((a) => [`${a.employee_id}:${a.date}`, a.shift_template_id]),
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
            Time &amp; Attendance
          </span>
          {isHrOrAdmin && (
            <Link href="/shifts/templates" className="text-[12px] font-bold text-primary">
              Manage shift types →
            </Link>
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink">Shift schedule</h1>
        <p className="text-[13px] text-ink-soft">
          A forward-looking roster of who&apos;s working which shift — separate from the weekly Present/Late/Absent
          attendance grid, which records what actually happened after the fact.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Your upcoming shifts</span>
        {myShifts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {myShifts.map((shift, i) => (
              <div key={i} className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
                <span className="text-[13px] font-bold text-ink">
                  {new Date(shift.date).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}
                </span>
                <span className="text-[13px] text-ink-soft">
                  {shift.shift_templates?.name ?? "—"}
                  {shift.shift_templates && ` · ${shift.shift_templates.start_time.slice(0, 5)}–${shift.shift_templates.end_time.slice(0, 5)}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface px-3 py-8 text-center text-[13px] text-ink-soft">
            {myEmployee ? "No shifts scheduled for you in the next two weeks." : "No employee record linked to your account."}
          </div>
        )}
      </section>

      {isManagingRole && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">
              {isDepartmentManager && !isHrOrAdmin ? "Your department's roster" : "Organization roster"}
            </span>
            <div className="flex gap-3">
              <Link href={`/shifts?week=${prevWeek}`} className="text-[12.5px] font-bold text-primary">
                ← Previous week
              </Link>
              <Link href={`/shifts?week=${nextWeek}`} className="text-[12.5px] font-bold text-primary">
                Next week →
              </Link>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-card border border-border bg-surface px-3 py-8 text-center text-[13px] text-ink-soft">
              No shift types defined yet.{" "}
              {isHrOrAdmin && (
                <Link href="/shifts/templates" className="font-bold text-primary">
                  Define one →
                </Link>
              )}
            </div>
          ) : (
            <ShiftAssignmentGrid employees={roster} dates={dates} templates={templates} assignmentsByKey={assignmentsByKey} />
          )}
        </section>
      )}
    </div>
  );
}
