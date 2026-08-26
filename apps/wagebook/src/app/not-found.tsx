import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <AuthCard title="404 — Page not found" subtitle="The page you're looking for doesn't exist or may have moved.">
      <Button href="/" fullWidth>
        Return home
      </Button>
    </AuthCard>
  );
}
