import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false });

  const unread = (notifications ?? []).filter((n) => !n.read_at);
  const read = (notifications ?? []).filter((n) => n.read_at);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.03em] text-ink-soft">Notifications</span>
          <h1 className="text-[22px] font-extrabold text-ink">System events as they happen across the platform</h1>
        </div>
        {unread.length > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-[12px] font-bold text-primary">
              Mark all read
            </button>
          </form>
        )}
      </header>

      {notifications && notifications.length > 0 ? (
        <div className="flex flex-col gap-2">
          {unread.map((n) => (
            <NotificationRow key={n.id} notification={n} unread />
          ))}
          {read.map((n) => (
            <NotificationRow key={n.id} notification={n} unread={false} />
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface px-3 py-10 text-center text-[13px] text-ink-soft">
          No notifications yet.
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  unread,
}: {
  notification: { id: string; message: string; link: string | null; created_at: string };
  unread: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-card border px-4 py-3 ${
        unread ? "border-primary bg-primary-tint" : "border-border bg-surface"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        {notification.link ? (
          <Link href={notification.link} className="text-[13px] font-bold text-ink hover:underline">
            {notification.message}
          </Link>
        ) : (
          <span className="text-[13px] font-bold text-ink">{notification.message}</span>
        )}
        <span className="text-[11px] text-ink-soft">{formatTimestamp(notification.created_at)}</span>
      </div>
      {unread && (
        <form action={markNotificationRead.bind(null, notification.id)}>
          <button type="submit" className="text-[12px] font-bold text-primary">
            Mark read
          </button>
        </form>
      )}
    </div>
  );
}
