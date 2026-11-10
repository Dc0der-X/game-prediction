import { handleWebhookEvent, verifyWebhook } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Payment state only ever changes here, after the Stripe signature over the raw body has been verified.
export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = verifyWebhook(raw, req.headers.get("stripe-signature"));
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }
  try {
    const outcome = await handleWebhookEvent(event);
    return Response.json({ received: true, outcome });
  } catch (e) {
    console.error("stripe webhook handler failed", event.id, e);
    // 500 makes Stripe retry; the idempotency ledger row is only written on success of the insert, so clear it.
    const { service } = await import("@/lib/db");
    await service()`delete from payment_events where id = ${event.id}`.catch(() => {});
    return Response.json({ error: "handler failed" }, { status: 500 });
  }
}
