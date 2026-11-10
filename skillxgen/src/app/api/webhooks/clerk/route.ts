import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { provisionClerkProfile } from "@/lib/auth";
import { service } from "@/lib/db";
import { audit } from "@/lib/audit";
import { authProvider, config } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keeps profiles in step with Clerk. Signature is verified (Svix) before anything is read.
export async function POST(req: Request) {
  if (authProvider() !== "clerk" || !config.clerkWebhookSecret()) return Response.json({ error: "not configured" }, { status: 404 });
  let evt;
  try {
    evt = await verifyWebhook(req as never, { signingSecret: config.clerkWebhookSecret() });
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }
  const sql = service();
  if (evt.type === "user.created" || evt.type === "user.updated") {
    const u = evt.data;
    const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
    if (primary && primary.verification?.status === "verified") {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      const id = await provisionClerkProfile(u.id, primary.email_address, name);
      if (id && evt.type === "user.updated") await sql`update profiles set email = ${primary.email_address.toLowerCase()}, full_name = case when ${name} = '' then full_name else ${name} end where id = ${id}`.catch(() => {});
    }
  } else if (evt.type === "user.deleted" && evt.data.id) {
    const [p] = await sql`update profiles set status = 'deleted' where auth_provider = 'clerk' and auth_user_id = ${evt.data.id} returning id`;
    if (p) await audit(null, "auth.clerk_user_deleted", "profile", p.id);
  }
  return Response.json({ received: true });
}
