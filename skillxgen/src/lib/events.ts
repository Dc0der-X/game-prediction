import { createHmac } from "node:crypto";
import { config } from "./env";

export type PlatformEvent = "lead.created" | "lead.stage_changed" | "payment.succeeded" | "enrolment.created" | "content.approved" | "webinar.registered";

/** Outbound automation hook (n8n). No-op unless N8N_WEBHOOK_URL is configured. Never blocks the request. */
export function emitEvent(type: PlatformEvent, payload: Record<string, unknown>) {
  const url = config.n8nWebhookUrl();
  if (!url) return;
  const body = JSON.stringify({ type, occurred_at: new Date().toISOString(), payload });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = config.n8nWebhookSecret();
  if (secret) headers["X-SkillXGen-Signature"] = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) }).catch((e) => console.error("n8n webhook failed", type, e?.message));
}
