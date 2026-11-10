// Signed session cookie for the local auth adapter. Web Crypto only, so it also runs in the proxy.
export const SESSION_COOKIE = "sxg_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64url");

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(profileId: string, secret: string, now = Date.now()): Promise<string> {
  const payload = `${profileId}.${Math.floor(now / 1000)}.${Math.floor(now / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<{ profileId: string; issuedAt: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [profileId, iat, exp, sig] = parts;
  if (!timingSafeEqual(sig, await hmac(secret, `${profileId}.${iat}.${exp}`))) return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  return { profileId, issuedAt: Number(iat) };
}
