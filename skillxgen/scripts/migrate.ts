// Applies db/migrations/*.sql in order. Usage: tsx scripts/migrate.ts [--reset]
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

export async function migrate(url: string, opts: { reset?: boolean; quiet?: boolean } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {}, ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined });
  const log = (m: string) => !opts.quiet && console.log(m);
  try {
    if (opts.reset) {
      const host = new URL(url).hostname;
      if (!["localhost", "127.0.0.1", "::1", "db", "postgres"].includes(host) && process.env.ALLOW_REMOTE_RESET !== "true") {
        throw new Error(`Refusing to reset non-local database host "${host}".`);
      }
      await sql.unsafe("drop schema if exists public cascade; drop schema if exists app cascade; create schema public;");
      log("database reset");
    }
    await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const applied = new Set((await sql`select name from public.schema_migrations`).map((r) => r.name));
    const dir = path.join(process.cwd(), "db", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (applied.has(file)) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(path.join(dir, file), "utf8"));
        await tx`insert into public.schema_migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
    log("migrations up to date");
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
  migrate(url, { reset: process.argv.includes("--reset") }).catch((e) => { console.error(e.message ?? e); process.exit(1); });
}
