import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Badge, EmptyState, Table } from "@/components/ui/card";

export const metadata = { title: "Payments" };
const TONE: Record<string, "success" | "warning" | "danger" | "default"> = { succeeded: "success", pending: "warning", failed: "danger", expired: "default", refunded: "default", partially_refunded: "warning" };

export default async function PaymentsPage() {
  const viewer = await requireViewer("/portal/payments");
  const rows = await withUser(viewer, (sql) => sql`select pay.id, pay.amount, pay.currency, pay.status, pay.receipt_number, pay.created_at, pay.provider, pg.title from payments pay join programmes pg on pg.id = pay.programme_id where pay.user_id = ${viewer.id} order by pay.created_at desc`);
  return (
    <>
      <PageTitle title="Payment history">Receipts for your programme payments. For refunds, open a billing support request.</PageTitle>
      {rows.length ? (
        <Table data-testid="payments-table">
          <thead><tr><th>Date</th><th>Programme</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}><td className="text-muted">{formatDate(p.created_at)}</td><td>{p.title}</td><td className="font-mono">{formatMoney(p.amount, p.currency)}</td>
              <td><Badge variant={TONE[p.status]}>{titleCase(p.status)}</Badge>{p.provider === "mock" ? <Badge className="ml-2">Test</Badge> : null}</td>
              <td>{p.receipt_number ? <Link href={`/portal/payments/${p.id}`} className="text-primary-hover hover:underline">{p.receipt_number}</Link> : "—"}</td></tr>
          ))}</tbody>
        </Table>
      ) : <EmptyState title="No payments yet">When you enrol in a paid programme, your receipts will be listed here.</EmptyState>}
    </>
  );
}
