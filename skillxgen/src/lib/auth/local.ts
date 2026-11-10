// Local auth adapter — development and automated tests only (see env.authProvider()).
// Production authentication is Clerk. This adapter exists so every journey can run offline.
import { service } from "../db";
import { siteUrl } from "../env";
import { sendEmail } from "../email";
import { audit } from "../audit";
import { hashPassword, verifyPassword, newToken, hashToken } from "./password";

const GENERIC_LOGIN_ERROR = "Incorrect email or password, or the email address has not been verified yet.";

export async function registerLocal(input: { email: string; password: string; fullName: string; marketingConsent: boolean }) {
  const sql = service();
  const existing = await sql`select id from profiles where email = ${input.email}`;
  // Same response whether or not the address is already registered (no account enumeration).
  if (existing.length) return;
  const passwordHash = await hashPassword(input.password);
  const profile = await sql.begin(async (tx) => {
    const [p] = await tx`insert into profiles (auth_provider, auth_user_id, email, full_name, marketing_consent)
      values ('local', ${crypto.randomUUID()}, ${input.email}, ${input.fullName}, ${input.marketingConsent}) returning id, email, full_name`;
    await tx`insert into local_auth_users (profile_id, password_hash) values (${p.id}, ${passwordHash})`;
    await tx`update leads set profile_id = ${p.id} where email = ${input.email} and profile_id is null`;
    return p;
  });
  await issueToken(profile.id, profile.email, profile.full_name, "verify_email");
  await audit({ id: profile.id, role: "student" }, "auth.register", "profile", profile.id);
}

async function issueToken(profileId: string, email: string, name: string, purpose: "verify_email" | "reset_password") {
  const sql = service();
  const token = newToken();
  const hours = purpose === "verify_email" ? 24 : 1;
  await sql`update local_auth_tokens set used_at = now() where profile_id = ${profileId} and purpose = ${purpose} and used_at is null`;
  await sql`insert into local_auth_tokens (profile_id, purpose, token_hash, expires_at)
    values (${profileId}, ${purpose}, ${hashToken(token)}, now() + make_interval(hours => ${hours}))`;
  const path = purpose === "verify_email" ? "/verify-email" : "/reset-password";
  await sendEmail({ to: email, template: purpose, vars: { name: name || "there", link: `${siteUrl()}${path}?token=${token}` } });
}

async function consumeToken(token: string, purpose: "verify_email" | "reset_password"): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await service()`update local_auth_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and purpose = ${purpose} and used_at is null and expires_at > now() returning profile_id`;
  return row?.profile_id ?? null;
}

export async function verifyEmailLocal(token: string): Promise<boolean> {
  const profileId = await consumeToken(token, "verify_email");
  if (!profileId) return false;
  await service()`update local_auth_users set email_verified_at = coalesce(email_verified_at, now()) where profile_id = ${profileId}`;
  await audit({ id: profileId, role: "student" }, "auth.email_verified", "profile", profileId);
  return true;
}

export async function loginLocal(email: string, password: string): Promise<{ profileId: string } | { error: string }> {
  const sql = service();
  const [u] = await sql`select p.id, p.status, p.role, l.password_hash, l.email_verified_at, l.locked_until
    from profiles p join local_auth_users l on l.profile_id = p.id where p.email = ${email} and p.auth_provider = 'local'`;
  if (!u) {
    await hashPassword(password); // keep timing comparable for unknown accounts
    return { error: GENERIC_LOGIN_ERROR };
  }
  if (u.locked_until && u.locked_until > new Date()) return { error: "Too many failed attempts. Try again in 15 minutes or reset your password." };
  if (!(await verifyPassword(password, u.password_hash))) {
    await sql`update local_auth_users set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end where profile_id = ${u.id}`;
    await audit({ id: u.id, role: u.role }, "auth.login_failed", "profile", u.id);
    return { error: GENERIC_LOGIN_ERROR };
  }
  if (!u.email_verified_at || u.status !== "active") return { error: GENERIC_LOGIN_ERROR };
  await sql`update local_auth_users set failed_attempts = 0, locked_until = null where profile_id = ${u.id}`;
  await sql`update profiles set last_seen_at = now() where id = ${u.id}`;
  await audit({ id: u.id, role: u.role }, "auth.login", "profile", u.id);
  return { profileId: u.id };
}

export async function requestPasswordResetLocal(email: string) {
  const [u] = await service()`select p.id, p.email, p.full_name from profiles p join local_auth_users l on l.profile_id = p.id
    where p.email = ${email} and p.status = 'active'`;
  if (u) await issueToken(u.id, u.email, u.full_name, "reset_password");
}

export async function resetPasswordLocal(token: string, password: string): Promise<boolean> {
  const profileId = await consumeToken(token, "reset_password");
  if (!profileId) return false;
  // A successful reset also proves control of the mailbox and revokes every existing session.
  await service()`update local_auth_users set password_hash = ${await hashPassword(password)}, failed_attempts = 0, locked_until = null,
    email_verified_at = coalesce(email_verified_at, now()), sessions_valid_after = now() where profile_id = ${profileId}`;
  await audit({ id: profileId, role: "student" }, "auth.password_reset", "profile", profileId);
  return true;
}

export async function resendVerificationLocal(email: string) {
  const [u] = await service()`select p.id, p.email, p.full_name from profiles p join local_auth_users l on l.profile_id = p.id
    where p.email = ${email} and l.email_verified_at is null and p.status = 'active'`;
  if (u) await issueToken(u.id, u.email, u.full_name, "verify_email");
}
