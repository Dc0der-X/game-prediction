// Securely provisions a staff account. No default credentials exist anywhere in the codebase.
//   Clerk:  tsx scripts/create-admin.ts --email you@company.com --role super_admin
//           (pre-authorises the address; the role is applied the first time that verified Clerk user signs in)
//   Local:  tsx scripts/create-admin.ts --email you@company.com --role admin --local
//           (creates a local-adapter account and prints a one-time random password)
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { hashPassword } from "../src/lib/auth/password";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const email = arg("email")?.toLowerCase();
  const role = arg("role") ?? "admin";
  const name = arg("name") ?? "";
  const local = process.argv.includes("--local");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Provide --email <address>");
  if (!["super_admin", "admin", "instructor"].includes(role)) throw new Error("--role must be super_admin, admin or instructor");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (local && process.env.NODE_ENV === "production" && process.env.LOCAL_AUTH_ALLOW_PRODUCTION !== "true") throw new Error("The local auth adapter is disabled in production. Omit --local to pre-authorise a Clerk user.");

  const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined });
  try {
    const [existing] = await sql`select id, auth_provider, auth_user_id from profiles where email = ${email}`;
    let id: string;
    if (existing) {
      await sql`update profiles set role = ${role}, status = 'active' where id = ${existing.id}`;
      id = existing.id;
      console.log(`Updated existing profile ${email} → ${role}`);
    } else {
      const [p] = await sql`insert into profiles (auth_provider, auth_user_id, email, full_name, role)
        values (${local ? "local" : "clerk"}, ${local ? crypto.randomUUID() : "pending:" + email}, ${email}, ${name}, ${role}) returning id`;
      id = p.id;
      console.log(local ? `Created local account ${email} (${role})` : `Pre-authorised ${email} as ${role}. The role applies when this verified address first signs in with Clerk.`);
    }
    if (local) {
      const password = randomBytes(15).toString("base64url");
      await sql`insert into local_auth_users (profile_id, password_hash, email_verified_at) values (${id}, ${await hashPassword(password)}, now())
        on conflict (profile_id) do update set password_hash = excluded.password_hash, email_verified_at = now(), sessions_valid_after = now(), failed_attempts = 0, locked_until = null`;
      console.log(`One-time password (shown once, change it via “Forgot password”): ${password}`);
    }
    await sql`insert into audit_logs (action, entity, entity_id, meta) values ('admin.provisioned_via_cli', 'profile', ${id}, ${sql.json({ role, local })})`;
  } finally {
    await sql.end();
  }
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
