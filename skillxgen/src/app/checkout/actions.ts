"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { fail, type ActionState } from "@/lib/forms";
import { rateLimit } from "@/lib/security";
import { isCurrency } from "@/lib/utils";
import { buildMockWebhook, createCheckout } from "@/lib/payments";
import { paymentsProvider } from "@/lib/env";
import { withUser, isUuid } from "@/lib/db";

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

const schema = z.object({ programme: z.string().regex(/^[a-z0-9-]{1,80}$/), currency: z.string().refine(isCurrency), coupon: z.string().trim().max(40).optional() });

export async function startCheckout(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Invalid checkout request.");
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/programmes/${parsed.data.programme}#enrol`)}`);
  if (!(await rateLimit(`checkout:${viewer.id}`, 10, 3600)).ok) return fail("Too many checkout attempts. Please try again later.");
  const result = await createCheckout(viewer, parsed.data.programme, parsed.data.currency as "usd" | "gbp" | "cad", parsed.data.coupon || null, await requestOrigin());
  if (!result.ok) return fail(result.message);
  redirect(result.url);
}

/** Mock provider only: delivers a locally signed event to the real webhook endpoint, so fulfilment follows the verified path. */
export async function simulateMockPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  if (paymentsProvider() !== "mock") return fail("Mock payments are disabled.");
  const viewer = await getViewer();
  const paymentId = fd.get("payment_id");
  const outcome = fd.get("outcome") === "failed" ? "failed" : "paid";
  if (!viewer || !isUuid(paymentId)) return fail("Invalid request.");
  const [own] = await withUser(viewer, (sql) => sql`select id from payments where id = ${paymentId} and user_id = ${viewer.id}`);
  if (!own) return fail("Payment not found.");
  try {
    const { payload, signature } = await buildMockWebhook(paymentId, outcome);
    const res = await fetch(`${await requestOrigin()}/api/webhooks/stripe`, { method: "POST", headers: { "stripe-signature": signature, "content-type": "application/json" }, body: payload });
    if (!res.ok) return fail(`Webhook delivery failed (${res.status}).`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not simulate the payment.");
  }
  redirect(`/checkout/status?payment=${paymentId}`);
}
