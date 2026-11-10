import { service } from "./db";
import { config } from "./env";

type SendInput = { to: string; template: string; vars?: Record<string, string>; marketing?: boolean };

export function renderTemplate(source: string, vars: Record<string, string>) {
  return source.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? "");
}

/**
 * Sends one transactional email. Without RESEND_API_KEY nothing leaves the machine: the message is
 * stored in email_outbox (visible in Admin → Email outbox). Marketing mail is suppressed for
 * unsubscribed or non-consenting recipients. There is deliberately no bulk-send API.
 */
export async function sendEmail({ to, template, vars = {}, marketing = false }: SendInput): Promise<{ status: string; id: string }> {
  const sql = service();
  const [tpl] = await sql`select subject, body from email_templates where key = ${template}`;
  if (!tpl) throw new Error(`Unknown email template: ${template}`);
  const subject = renderTemplate(tpl.subject, vars).replace(/[\r\n]+/g, " ").slice(0, 200);
  const body = renderTemplate(tpl.body, vars);

  let status: "stored" | "sent" | "failed" | "suppressed" = "stored";
  let provider = "outbox";
  let error: string | null = null;

  if (marketing) {
    const [lead] = await sql`select consent_marketing, unsubscribed_at from leads where email = ${to}`;
    if (!lead || !lead.consent_marketing || lead.unsubscribed_at) status = "suppressed";
  }
  const key = config.resendKey();
  if (status !== "suppressed" && key) {
    provider = "resend";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: config.emailFrom(), to: [to], subject, text: body }),
        signal: AbortSignal.timeout(10_000),
      });
      status = res.ok ? "sent" : "failed";
      if (!res.ok) error = `Resend responded ${res.status}`;
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "send failed";
    }
  }
  const [row] = await sql`insert into email_outbox (to_email, template_key, subject, body, provider, status, error)
    values (${to}, ${template}, ${subject}, ${body}, ${provider}, ${status}, ${error}) returning id`;
  return { status, id: row.id };
}
