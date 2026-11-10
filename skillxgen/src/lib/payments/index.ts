import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { service } from "../db";
import { paymentsProvider, siteUrl, stripeSecretKey, stripeWebhookSecret } from "../env";
import { formatMoney, type Currency } from "../utils";
import { sendEmail } from "../email";
import { audit } from "../audit";
import { emitEvent } from "../events";
import { couponProblem, discountFor, priceFor, type Coupon } from "./pricing";

let stripeClient: Stripe | undefined;
// The mock provider only uses the SDK's local webhook signing/verification helpers; no network calls are made.
export const stripe = () => (stripeClient ??= new Stripe(stripeSecretKey() ?? "sk_test_mock_provider_no_network"));

export type CheckoutResult = { ok: true; url: string; paymentId: string } | { ok: false; message: string };

export async function createCheckout(user: { id: string; email: string }, programmeSlug: string, currency: Currency, couponCode: string | null, origin: string): Promise<CheckoutResult> {
  const provider = paymentsProvider();
  if (provider === "unconfigured") return { ok: false, message: "Online payment is not configured yet. Please send an enquiry and we will help you enrol." };
  const sql = service();
  const [programme] = await sql`select id, title, slug, price_usd, price_gbp, price_cad, enquiry_only from programmes where slug = ${programmeSlug} and status = 'published'`;
  if (!programme) return { ok: false, message: "Programme not found." };
  const base = priceFor(programme as never, currency);
  if (base == null) return { ok: false, message: "This programme is enrolled by enquiry. Please contact us." };
  const [already] = await sql`select 1 from enrolments where user_id = ${user.id} and programme_id = ${programme.id} and status in ('active', 'completed')`;
  if (already) return { ok: false, message: "You are already enrolled in this programme." };

  let discount = 0;
  let couponId: string | null = null;
  if (couponCode) {
    const [coupon] = await sql`select * from coupons where code = ${couponCode}`;
    const problem = couponProblem(coupon as Coupon | undefined, programme.id, currency);
    if (problem) return { ok: false, message: problem };
    discount = discountFor(base, coupon as Coupon);
    couponId = coupon.id;
  }
  const amount = base - discount;
  const [payment] = await sql`insert into payments (user_id, programme_id, currency, amount, discount_amount, coupon_id, provider)
    values (${user.id}, ${programme.id}, ${currency}, ${amount}, ${discount}, ${couponId}, ${provider}) returning id`;

  let sessionId: string, url: string, livemode = false;
  if (provider === "stripe") {
    try {
      const session = await stripe().checkout.sessions.create({
        mode: "payment",
        client_reference_id: payment.id,
        customer_email: user.email,
        metadata: { payment_id: payment.id, programme: programme.slug },
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: amount, product_data: { name: `SkillXGen — ${programme.title}` } } }],
        success_url: `${siteUrl()}/checkout/status?payment=${payment.id}`,
        cancel_url: `${siteUrl()}/programmes/${programme.slug}?checkout=cancelled`,
      });
      if (!session.url) throw new Error("Stripe returned no checkout URL");
      sessionId = session.id; url = session.url; livemode = session.livemode;
    } catch (e) {
      await sql`update payments set status = 'failed', failure_reason = 'checkout_session_error' where id = ${payment.id}`;
      console.error("stripe checkout error", e);
      return { ok: false, message: "We could not start the checkout. No payment was taken — please try again." };
    }
  } else {
    sessionId = `cs_mock_${randomUUID().replace(/-/g, "")}`;
    url = `${origin}/checkout/mock/${payment.id}`;
  }
  await sql`update payments set provider_session_id = ${sessionId}, livemode = ${livemode} where id = ${payment.id}`;
  await audit({ id: user.id, role: "student" }, "payment.checkout_started", "payment", payment.id, { programme: programme.slug, currency, amount, provider });
  return { ok: true, url, paymentId: payment.id };
}

/** Verifies the Stripe signature over the raw body. Throws on any mismatch. */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("Webhook secret is not configured");
  if (!signature) throw new Error("Missing signature");
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}

type SessionLike = { id: string; payment_status?: string; amount_total?: number | null; currency?: string | null; payment_intent?: unknown; metadata?: Record<string, string> | null };

/** Applies a verified event. Idempotent: each event id is processed at most once. */
export async function handleWebhookEvent(event: Stripe.Event): Promise<string> {
  const sql = service();
  const fresh = await sql`insert into payment_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
  if (!fresh.length) return "duplicate";
  const obj = event.data.object as unknown as SessionLike & { refunds?: { data?: { id: string; amount: number; reason?: string | null }[] }; amount_refunded?: number; amount?: number };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      if (obj.payment_status !== "paid") return "awaiting_payment";
      return fulfil(obj);
    case "checkout.session.async_payment_failed":
      return markUnsuccessful(obj.id, "failed", "payment_failed");
    case "checkout.session.expired":
      return markUnsuccessful(obj.id, "expired", "session_expired");
    case "charge.refunded": {
      const intent = typeof obj.payment_intent === "string" ? obj.payment_intent : null;
      const [payment] = intent ? await sql`select id, amount, user_id, programme_id from payments where provider_payment_intent = ${intent}` : [];
      if (!payment) return "payment_not_found";
      for (const r of obj.refunds?.data ?? []) {
        await sql`insert into refunds (payment_id, amount, reason, status, provider_refund_id) values (${payment.id}, ${r.amount}, ${r.reason ?? ""}, 'processed', ${r.id})
          on conflict (provider_refund_id) do nothing`;
      }
      const full = (obj.amount_refunded ?? 0) >= payment.amount;
      await sql`update payments set status = ${full ? "refunded" : "partially_refunded"} where id = ${payment.id}`;
      if (full) await sql`update enrolments set status = 'refunded' where payment_id = ${payment.id}`;
      await audit(null, "payment.refunded", "payment", payment.id, { full, amount_refunded: obj.amount_refunded });
      return "refunded";
    }
    default:
      return "ignored";
  }
}

async function markUnsuccessful(sessionId: string, status: "failed" | "expired", reason: string) {
  const sql = service();
  const [p] = await sql`update payments set status = ${status}, failure_reason = ${reason}
    where provider_session_id = ${sessionId} and status = 'pending' returning id, user_id, programme_id`;
  if (!p) return "payment_not_found";
  const [info] = await sql`select pr.email, pr.full_name, pg.title, pg.slug from profiles pr, programmes pg where pr.id = ${p.user_id} and pg.id = ${p.programme_id}`;
  await sql`insert into notifications (user_id, title, body, link) values (${p.user_id}, 'Payment not completed', ${`Your payment for ${info.title} did not complete. You have not been charged.`}, ${`/programmes/${info.slug}`})`;
  if (status === "failed") await sendEmail({ to: info.email, template: "payment_failed", vars: { name: info.full_name || "there", programme: info.title, link: `${siteUrl()}/programmes/${info.slug}` } });
  await audit(null, `payment.${status}`, "payment", p.id, { reason });
  return status;
}

async function fulfil(session: SessionLike): Promise<string> {
  const sql = service();
  const result = await sql.begin(async (tx) => {
    const [p] = await tx`select * from payments where provider_session_id = ${session.id} for update`;
    if (!p) return { outcome: "payment_not_found" as const };
    if (p.status === "succeeded") return { outcome: "already_fulfilled" as const };
    // Never trust the browser: the amount and currency Stripe actually collected must match our record.
    if (session.amount_total !== p.amount || (session.currency ?? "").toLowerCase() !== p.currency) {
      await tx`update payments set status = 'failed', failure_reason = 'amount_mismatch' where id = ${p.id}`;
      return { outcome: "amount_mismatch" as const, payment: p };
    }
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const [updated] = await tx`update payments set status = 'succeeded', paid_at = now(), provider_payment_intent = ${intent},
      receipt_number = 'SXG-' || to_char(now(), 'YYYY') || '-' || nextval('receipt_seq') where id = ${p.id} returning receipt_number`;
    const [enrolment] = await tx`insert into enrolments (user_id, programme_id, source, payment_id) values (${p.user_id}, ${p.programme_id}, 'payment', ${p.id})
      on conflict (user_id, programme_id) where programme_id is not null do update set status = 'active', payment_id = excluded.payment_id returning id`;
    if (p.coupon_id) await tx`update coupons set redeemed_count = redeemed_count + 1 where id = ${p.coupon_id}`;
    const [info] = await tx`select pr.email, pr.full_name, pg.title from profiles pr, programmes pg where pr.id = ${p.user_id} and pg.id = ${p.programme_id}`;
    await tx`insert into notifications (user_id, title, body, link) values (${p.user_id}, 'Payment confirmed — you are enrolled',
      ${`Your payment for ${info.title} was confirmed. Receipt ${updated.receipt_number}.`}, '/portal/learning')`;
    await tx`update leads set stage = 'won' where profile_id = ${p.user_id} and stage not in ('won', 'lost')`;
    return { outcome: "fulfilled" as const, payment: p, receipt: updated.receipt_number as string, info, enrolmentId: enrolment.id as string };
  });
  if (result.outcome === "amount_mismatch") await audit(null, "payment.amount_mismatch", "payment", result.payment.id, { expected: result.payment.amount, got: session.amount_total });
  if (result.outcome === "fulfilled") {
    const { payment: p, info, receipt } = result;
    await sendEmail({ to: info.email, template: "payment_receipt", vars: { name: info.full_name || "there", programme: info.title, amount: formatMoney(p.amount, p.currency), receipt_number: receipt, link: `${siteUrl()}/portal/payments` } });
    await audit(null, "payment.succeeded", "payment", p.id, { receipt, amount: p.amount, currency: p.currency });
    await audit(null, "enrolment.created", "enrolment", result.enrolmentId, { source: "payment", payment_id: p.id });
    emitEvent("payment.succeeded", { payment_id: p.id, programme_id: p.programme_id, amount: p.amount, currency: p.currency });
    emitEvent("enrolment.created", { enrolment_id: result.enrolmentId, user_id: p.user_id, programme_id: p.programme_id });
  }
  return result.outcome;
}

/** Mock provider: builds a Stripe-shaped event, signs it with the local webhook secret, and returns the signed request parts. */
export async function buildMockWebhook(paymentId: string, outcome: "paid" | "failed") {
  if (paymentsProvider() !== "mock") throw new Error("Mock payments are disabled");
  const [p] = await service()`select id, amount, currency, provider_session_id from payments where id = ${paymentId} and provider = 'mock' and status = 'pending'`;
  if (!p) throw new Error("No pending mock payment");
  const payload = JSON.stringify({
    id: `evt_mock_${randomUUID().replace(/-/g, "")}`,
    object: "event",
    type: outcome === "paid" ? "checkout.session.completed" : "checkout.session.async_payment_failed",
    data: { object: { id: p.provider_session_id, object: "checkout.session", payment_status: outcome === "paid" ? "paid" : "unpaid", amount_total: p.amount, currency: p.currency, payment_intent: `pi_mock_${p.id.replace(/-/g, "")}`, metadata: { payment_id: p.id } } },
  });
  const signature = stripe().webhooks.generateTestHeaderString({ payload, secret: stripeWebhookSecret()! });
  return { payload, signature };
}
