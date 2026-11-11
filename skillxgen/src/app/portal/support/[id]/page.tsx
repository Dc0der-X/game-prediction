import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Alert, Badge } from "@/components/ui/card";
import { TicketReplyForm } from "@/components/portal/forms";

export const metadata = { title: "Support request" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/support/${id}`);
  const data = await withUser(viewer, async (sql) => {
    const [t] = await sql`select * from support_tickets where id = ${id} and user_id = ${viewer.id}`;
    return t ? { t, messages: await sql`select m.body, m.is_staff, m.created_at from ticket_messages m where m.ticket_id = ${id} order by m.created_at` } : null;
  });
  if (!data) notFound();
  return (
    <>
      <Link href="/portal/support" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Support</Link>
      <div className="mt-4" />
      <PageTitle title={data.t.subject}><span className="flex gap-2"><Badge>{titleCase(data.t.category)}</Badge><Badge variant="primary" data-testid="ticket-status">{data.t.status}</Badge></span></PageTitle>
      <ol className="max-w-3xl space-y-4">
        {data.messages.map((m, i) => (
          <li key={i} className={cn("rounded-lg border p-4", m.is_staff ? "border-primary/40 bg-primary-soft/30" : "border-border bg-card")}>
            <p className="font-mono text-xs text-subtle">{m.is_staff ? "SkillXGen support" : "You"} · {formatDate(m.created_at, true)}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 max-w-3xl">{data.t.status === "closed" ? <Alert>This request is closed. Open a new one if you need more help.</Alert> : <TicketReplyForm ticketId={id} />}</div>
    </>
  );
}
