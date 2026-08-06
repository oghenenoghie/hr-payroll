import { redirect } from "next/navigation";

// Course management now lives inline on /learning as a single landing
// page for admin/hr_manager — this route stays only so any existing
// bookmark or link still lands somewhere useful, rather than 404ing.
export default function TrainingCoursesPage() {
  redirect("/learning");
}
