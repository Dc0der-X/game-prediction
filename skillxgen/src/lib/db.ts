import postgres, { type Sql } from "postgres";
import { config } from "./env";

// Two access paths over one pool:
//   service()  — the owning role. Bypasses RLS. ONLY for trusted server work that has no end-user
//                identity (auth provisioning, verified webhooks, anonymous lead capture, audit writes).
//   withUser() — drops to the restricted skillxgen_app role for the duration of a transaction and
//                pins app.user_id, so PostgreSQL Row Level Security decides what the caller can touch.
// All queries are tagged templates => always parameterised.

const g = globalThis as unknown as { __sxgSql?: Sql };

export function service(): Sql {
  if (!g.__sxgSql) {
    const url = config.databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:migrate`.");
    g.__sxgSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: config.databaseSsl() === "require" ? "require" : undefined,
      onnotice: () => {},
    });
  }
  return g.__sxgSql;
}

export type Db = Sql;
export type Identity = { id: string } | null | undefined;

export async function withUser<T>(identity: Identity, fn: (sql: Db) => Promise<T>): Promise<T> {
  const result = await service().begin(async (tx) => {
    await tx`select set_config('role', 'skillxgen_app', true), set_config('app.user_id', ${identity?.id ?? ""}, true)`;
    return fn(tx as unknown as Db);
  });
  return result as T;
}

export async function closeDb() {
  if (g.__sxgSql) {
    await g.__sxgSql.end({ timeout: 5 });
    g.__sxgSql = undefined;
  }
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
