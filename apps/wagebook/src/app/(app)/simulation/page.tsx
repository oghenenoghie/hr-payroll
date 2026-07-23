import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/membership";
import { SimulationSlider } from "./SimulationSlider";

export default async function SimulationPage() {
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

  const { data: employees } = await supabase
    .from("employees")
    .select("id, basic_kobo, housing_kobo, transport_kobo, annual_rent_kobo")
    .eq("status", "active");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Payroll Simulation</span>
        <h1 className="text-[22px] font-extrabold text-ink">What-if analysis across the whole workforce</h1>
        <p className="text-[13px] text-ink-soft">
          Model an org-wide raise and see the statutory cost impact before committing to it — every figure recomputed
          by the same compliance engine that runs real payroll, on your actual {employees?.length ?? 0} active
          employees.
        </p>
      </header>

      <SimulationSlider
        employees={(employees ?? []).map((e) => ({
          id: e.id,
          basicKobo: e.basic_kobo,
          housingKobo: e.housing_kobo,
          transportKobo: e.transport_kobo,
          annualRentKobo: e.annual_rent_kobo,
        }))}
      />
    </div>
  );
}
