import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Payment status", robots: { index: false } };

// The status shown here is read from our database, which only the verified webhook can change.
// Arriving on this page — or editing the URL — never marks anything as paid.
export default async function CheckoutStatusPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment: id } = await searchParams;
  const viewer = await requireViewer(`/checkout/status?payment=${id ?? ""}`);
  const [p] = isUuid(id) ? await withUser(viewer, (sql) => sql`select pay.*, pg.title, pg.slug from payments pay join programmes pg on pg.id = pay.programme_id where pay.id = ${id} and pay.user_id = ${viewer.id}`) : [];
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-lg">
        <Link href="/" aria-label="SkillXGen home"><Logo /></Link>
        <Card className="mt-8"><CardContent className="p-8" data-testid="payment-status" data-status={p?.status ?? "unknown"}>
          {!p ? <><h1 className="text-2xl font-semibold">Payment not found</h1><p className="mt-2 text-muted">We could not find that payment on your account.</p></>
            : p.status === "succeeded" ? (
              <>
                <p className="kicker text-success">Payment confirmed</p>
                <h1 className="mt-3 text-2xl font-semibold">You are enrolled in {p.title}</h1>
                <p className="mt-2 text-muted">We received {formatMoney(p.amount, p.currency)}. Receipt {p.receipt_number}.</p>
                <div className="mt-6 flex flex-wrap gap-3"><Button asChild><Link href="/portal/learning">Start learning</Link></Button><Button asChild variant="outline"><Link href={`/portal/payments/${p.id}`}>View receipt</Link></Button></div>
              </>
            ) : p.status === "pending" ? (
              <>
                <meta httpEquiv="refresh" content="4" />
                <p className="kicker">Confirming</p>
                <h1 className="mt-3 text-2xl font-semibold">Waiting for payment confirmation…</h1>
                <p className="mt-2 text-muted">This page refreshes automatically. Your enrolment starts as soon as Stripe confirms the payment to us. You can safely close this page — we will also email you.</p>
              </>
            ) : (
              <>
                <p className="kicker">Not completed</p>
                <h1 className="mt-3 text-2xl font-semibold">The payment did not go through</h1>
                <Alert tone="warning" className="mt-4">Status: {String(p.status).replace(/_/g, " ")}. You have not been charged for an incomplete payment.</Alert>
                <Button asChild className="mt-6"><Link href={`/programmes/${p.slug}#enrol`}>Try again</Link></Button>
              </>
            )}
        </CardContent></Card>
      </div>
    </main>
  );
}
