import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";

export default function NotFound() {
  return (
    <AuthCard title="404 — Page not found" subtitle="The page you're looking for doesn't exist or may have moved.">
      <Link
        href="/"
        className="flex w-full items-center justify-center rounded-button bg-primary px-[22px] py-[11px] text-[13px] font-extrabold text-white"
      >
        Return home
      </Link>
    </AuthCard>
  );
}
