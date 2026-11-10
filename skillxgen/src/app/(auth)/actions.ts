"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authProvider, localAuthSecret, siteUrl } from "@/lib/env";
import { checkbox, email, fail, ok, parseForm, password, text, type ActionState } from "@/lib/forms";
import { rateLimit, rateLimitByIp, safeRedirectPath } from "@/lib/security";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/auth/session";
import { loginLocal, registerLocal, requestPasswordResetLocal, resendVerificationLocal, resetPasswordLocal } from "@/lib/auth/local";

const LIMITED = "Too many attempts. Please wait a few minutes and try again.";
const assertLocal = () => { if (authProvider() !== "local") throw new Error("Local authentication is disabled."); };

const registerSchema = z.object({
  full_name: text(120, 2),
  email,
  password,
  terms: checkbox.refine((v) => v, "You must accept the terms to create an account"),
  marketing_consent: checkbox,
});

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  assertLocal();
  if (!(await rateLimitByIp("auth:register", 10, 3600)).ok) return fail(LIMITED);
  const p = parseForm(registerSchema, fd);
  if (p.error) return p.error;
  await registerLocal({ email: p.data.email, password: p.data.password, fullName: p.data.full_name, marketingConsent: p.data.marketing_consent });
  redirect(`/verify-email?sent=1&email=${encodeURIComponent(p.data.email)}`);
}

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(200), redirect_url: z.string().optional() });

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  assertLocal();
  const p = parseForm(loginSchema, fd);
  if (p.error) return p.error;
  const [byIp, byEmail] = await Promise.all([rateLimitByIp("auth:login", 30, 900), rateLimit(`auth:login:${p.data.email}`, 10, 900)]);
  if (!byIp.ok || !byEmail.ok) return fail(LIMITED);
  const result = await loginLocal(p.data.email, p.data.password);
  if ("error" in result) return fail(result.error);
  (await cookies()).set(SESSION_COOKIE, await signSession(result.profileId, localAuthSecret()), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS, secure: siteUrl().startsWith("https://"),
  });
  redirect(safeRedirectPath(p.data.redirect_url, "/portal"));
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  assertLocal();
  if (!(await rateLimitByIp("auth:forgot", 8, 3600)).ok) return fail(LIMITED);
  const p = parseForm(z.object({ email }), fd);
  if (p.error) return p.error;
  await requestPasswordResetLocal(p.data.email);
  return ok("If an account exists for that address, a reset link has been sent.");
}

export async function resendVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  assertLocal();
  if (!(await rateLimitByIp("auth:resend", 5, 3600)).ok) return fail(LIMITED);
  const p = parseForm(z.object({ email }), fd);
  if (p.error) return p.error;
  await resendVerificationLocal(p.data.email);
  return ok("If that account still needs verifying, a new link has been sent.");
}

const resetSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, "Invalid link"), password });

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  assertLocal();
  if (!(await rateLimitByIp("auth:reset", 10, 3600)).ok) return fail(LIMITED);
  const p = parseForm(resetSchema, fd);
  if (p.error) return p.error;
  if (!(await resetPasswordLocal(p.data.token, p.data.password))) return fail("This reset link is invalid or has expired. Request a new one.");
  // Touch headers so the redirect is always treated as dynamic.
  await headers();
  redirect("/sign-in?reset=1");
}
