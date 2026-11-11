import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/card";
import { MarkRead } from "@/components/portal/forms";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/portal/notifications");
  const rows = await withUser(viewer, (sql) => sql`select id, title, body, link, read_at, created_at from notifications where user_id = ${viewer.id} order by created_at desc limit 100`);
  return (
    <>
      <PageTitle title="Notifications" actions={rows.some((r) => !r.read_at) ? <MarkRead /> : null} />
      {rows.length ? (
        <ul className="max-w-3xl divide-y divide-border rounded-lg border border-border">
          {rows.map((n) => (
            <li key={n.id} className={cn("flex items-start justify-between gap-4 p-4", !n.read_at && "bg-card")}>
              <div>
                <p className="font-medium">{!n.read_at ? <span className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle" aria-label="Unread" /> : null}{n.link ? <Link href={n.link} className="hover:text-primary-hover">{n.title}</Link> : n.title}</p>
                <p className="mt-1 text-sm text-muted">{n.body}</p>
                <p className="mt-1 font-mono text-xs text-subtle">{formatDate(n.created_at, true)}</p>
              </div>
              {!n.read_at ? <MarkRead id={n.id} /> : null}
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No notifications yet">Feedback on your work, payment confirmations and support replies will appear here.</EmptyState>}
    </>
  );
}
