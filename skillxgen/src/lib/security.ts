import { headers } from "next/headers";
import { siteUrl } from "./env";
import { service } from "./db";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

/** CSRF defence for cookie-authenticated route handlers (Server Actions get this from Next.js itself). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

/** Fixed-window rate limiter backed by PostgreSQL so it holds across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }> {
  const sql = service();
  const [row] = await sql`
    insert into rate_limits (key, window_start, count)
    values (${key.slice(0, 200)}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  if (Math.random() < 0.02) await sql`delete from rate_limits where window_start < now() - interval '1 day'`;
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count) };
}

export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  return rateLimit(`${scope}:${await clientIp()}`, limit, windowSeconds);
}

/** Only allow http(s) links from user input (blocks javascript:, data: …). */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Internal redirect targets only — prevents open redirects. */
export function safeRedirectPath(value: string | null | undefined, fallback = "/portal"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
