import { service } from "./db";

export type AuditActor = { id: string; role: string } | null;

/** Append-only audit trail. Written with the service role; the app role can only read it (audit.view). */
export async function audit(actor: AuditActor, action: string, entity: string, entityId?: string | null, meta: Record<string, unknown> = {}, ip?: string) {
  try {
    const sql = service();
    await sql`insert into audit_logs (actor_id, actor_role, action, entity, entity_id, meta, ip)
      values (${actor?.id ?? null}, ${actor?.role ?? null}, ${action}, ${entity}, ${entityId ?? null}, ${sql.json(meta as never)}, ${ip ?? null})`;
  } catch (e) {
    console.error("audit log write failed", action, entity, e);
  }
}
