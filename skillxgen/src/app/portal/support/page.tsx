import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Badge, Card, CardContent, Table } from "@/components/ui/card";
import { TicketForm } from "@/components/portal/forms";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const viewer = await requireViewer("/portal/support");
  const tickets = await withUser(viewer, (sql) => sql`select id, subject, category, status, updated_at from support_tickets where user_id = ${viewer.id} order by updated_at desc`);
  return (
    <>
      <PageTitle title="Support">Questions about your course, account, billing or career support. We reply within two working days.</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="self-start"><CardContent><p className="kicker mb-4">New request</p><TicketForm /></CardContent></Card>
        <div>
          <p className="kicker mb-4">Your requests</p>
          {tickets.length ? (
            <Table><thead><tr><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>{tickets.map((t) => <tr key={t.id}><td><Link href={`/portal/support/${t.id}`} className="font-medium hover:text-primary-hover">{t.subject}</Link></td><td className="text-muted">{titleCase(t.category)}</td><td><Badge variant={t.status === "open" ? "primary" : t.status === "pending" ? "warning" : "success"}>{t.status}</Badge></td><td className="text-muted">{formatDate(t.updated_at)}</td></tr>)}</tbody>
            </Table>
          ) : <p className="text-sm text-muted">You have not opened any support requests.</p>}
        </div>
      </div>
    </>
  );
}
