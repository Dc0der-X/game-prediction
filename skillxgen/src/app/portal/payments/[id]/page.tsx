import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/payments/${id}`);
  const data = await withUser(viewer, async (sql) => {
    const [p] = await sql`select pay.*, pg.title, pr.full_name, pr.email from payments pay join programmes pg on pg.id = pay.programme_id join profiles pr on pr.id = pay.user_id where pay.id = ${id} and pay.user_id = ${viewer.id} and pay.receipt_number is not null`;
    return p ? { p, refunds: await sql`select amount, reason, status, created_at from refunds where payment_id = ${id} order by created_at` } : null;
  });
  if (!data) notFound();
  const { p, refunds } = data;
  return (
    <>
      <div className="no-print mb-6 flex items-center justify-between"><Link href="/portal/payments" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Payments</Link><PrintButton label="Print or save as PDF" /></div>
      <article className="print-surface max-w-2xl rounded-lg border border-border bg-card p-8" data-testid="receipt">
        <div className="flex items-start justify-between"><Logo /><div className="text-right"><p className="kicker">Payment receipt</p><p className="mt-1 font-mono text-sm">{p.receipt_number}</p></div></div>
        <dl className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div><dt className="text-subtle">Billed to</dt><dd className="mt-1">{p.full_name || p.email}<br /><span className="text-muted">{p.email}</span></dd></div>
          <div><dt className="text-subtle">Date paid</dt><dd className="mt-1">{formatDate(p.paid_at, true)}</dd></div>
        </dl>
        <table className="mt-8 w-full text-sm">
          <thead><tr className="border-b border-border text-left text-subtle"><th className="py-2 font-normal">Description</th><th className="py-2 text-right font-normal">Amount</th></tr></thead>
          <tbody>
            <tr className="border-b border-border"><td className="py-3">{p.title}</td><td className="py-3 text-right font-mono">{formatMoney(p.amount + p.discount_amount, p.currency)}</td></tr>
            {p.discount_amount > 0 ? <tr className="border-b border-border"><td className="py-3 text-muted">Coupon discount</td><td className="py-3 text-right font-mono">−{formatMoney(p.discount_amount, p.currency)}</td></tr> : null}
            <tr><td className="py-3 font-semibold">Total paid ({p.currency.toUpperCase()})</td><td className="py-3 text-right font-mono font-semibold">{formatMoney(p.amount, p.currency)}</td></tr>
          </tbody>
        </table>
        {refunds.length ? <div className="mt-6 text-sm"><p className="text-subtle">Refunds</p>{refunds.map((r, i) => <p key={i} className="mt-1">{formatMoney(r.amount, p.currency)} · {titleCase(r.status)} · {formatDate(r.created_at)}{r.reason ? ` — ${r.reason}` : ""}</p>)}</div> : null}
        <p className="mt-8 text-xs text-subtle">Status: {titleCase(p.status)}. {p.provider === "mock" ? "TEST PAYMENT — no money was taken. " : ""}Payment processed by Stripe. This receipt is not a tax invoice unless tax details are shown.</p>
      </article>
    </>
  );
}
