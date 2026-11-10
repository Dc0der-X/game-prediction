import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { paymentsProvider } from "@/lib/env";
import { formatMoney } from "@/lib/utils";
import { Alert, Card, CardContent } from "@/components/ui/card";
import { MockPayButtons } from "@/components/site/mock-pay";

export const metadata = { title: "Test checkout", robots: { index: false } };

export default async function MockCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (paymentsProvider() !== "mock" || !isUuid(id)) notFound();
  const viewer = await requireViewer(`/checkout/mock/${id}`);
  const [p] = await withUser(viewer, (sql) => sql`select pay.id, pay.amount, pay.currency, pay.status, pay.discount_amount, pg.title from payments pay join programmes pg on pg.id = pay.programme_id where pay.id = ${id} and pay.user_id = ${viewer.id} and pay.provider = 'mock'`);
  if (!p) notFound();
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-16">
      <Card className="w-full max-w-lg"><CardContent className="p-8">
        <p className="kicker">Local test checkout</p>
        <h1 className="mt-3 text-2xl font-semibold">{p.title}</h1>
        <p className="mt-2 text-3xl font-semibold" data-testid="mock-amount">{formatMoney(p.amount, p.currency)}</p>
        {p.discount_amount > 0 ? <p className="mt-1 text-sm text-success">Includes a coupon discount of {formatMoney(p.discount_amount, p.currency)}.</p> : null}
        <Alert tone="warning" className="mt-6">No real payment is taken. This screen stands in for Stripe Checkout when no Stripe key is configured. Each button sends a signed event to the same webhook Stripe would call.</Alert>
        {p.status === "pending" ? <MockPayButtons paymentId={p.id} /> : <Alert className="mt-6">This test payment is already {p.status}.</Alert>}
      </CardContent></Card>
    </main>
  );
}
