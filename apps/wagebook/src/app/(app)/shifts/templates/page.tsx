import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { ShiftTemplateForm } from "./ShiftTemplateForm";
import { deleteShiftTemplate } from "../actions";

const thClass = "px-3 py-[10px] text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft";
const tdClass = "px-3 py-[10px] text-[13px]";

export default async function ShiftTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getMembership(supabase, user.id);
  if (!membership || (membership.role !== "admin" && membership.role !== "hr_manager")) {
    redirect("/shifts");
  }

  const { data: templates } = await supabase
    .from("shift_templates")
    .select("id, name, start_time, end_time")
    .order("start_time");

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <Link href="/shifts" className="text-[12px] font-bold text-primary">
          ← Shift schedule
        </Link>
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Time &amp; Attendance</span>
        <h1 className="text-[22px] font-extrabold text-ink">Shift types</h1>
        <p className="text-[13px] text-ink-soft">
          The catalog of shifts available to assign on the schedule — a department manager picks from these, they
          don&apos;t define new ones.
        </p>
      </header>

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={`${thClass} text-left`}>Name</th>
              <th className={`${thClass} text-left`}>Hours</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <tr key={template.id} className="border-b border-border last:border-b-0">
                  <td className={`${tdClass} font-bold text-ink`}>{template.name}</td>
                  <td className={`${tdClass} text-ink-soft`}>
                    {template.start_time.slice(0, 5)}–{template.end_time.slice(0, 5)}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConfirmActionButton
                      action={deleteShiftTemplate.bind(null, template.id)}
                      label="Delete"
                      confirmTitle="Delete this shift type?"
                      confirmMessage={`"${template.name}" will be removed. Any existing assignments to it are removed too.`}
                      confirmLabel="Delete"
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-[13px] text-ink-soft">
                  No shift types yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Define a shift type</span>
        <div className="mt-3">
          <ShiftTemplateForm />
        </div>
      </div>
    </div>
  );
}
