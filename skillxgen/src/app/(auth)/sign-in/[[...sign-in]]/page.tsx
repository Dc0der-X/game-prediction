import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { authProvider } from "@/lib/env";
import { getViewer } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/security";
import { LocalSignIn } from "@/components/auth-forms";
import { Alert } from "@/components/ui/card";
import { AuthNotConfigured } from "@/components/auth-status";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string; reset?: string; verified?: string }> }) {
  const sp = await searchParams;
  const provider = authProvider();
  const target = safeRedirectPath(sp.redirect_url, "/portal");
  if (provider !== "unconfigured" && (await getViewer())) redirect(target);
  if (provider === "unconfigured") return <AuthNotConfigured />;
  if (provider === "clerk") return <SignIn signUpUrl="/sign-up" fallbackRedirectUrl={target} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Sign in</h1><p className="mt-1 text-sm text-muted">Welcome back. Pick up where you left off.</p></div>
      {sp.reset ? <Alert tone="success">Your password has been updated. Sign in with the new password.</Alert> : null}
      {sp.verified ? <Alert tone="success">Email verified. You can sign in now.</Alert> : null}
      <LocalSignIn redirectUrl={target} />
      <p className="text-sm text-muted">New to SkillXGen? <Link href="/sign-up" className="text-primary-hover hover:underline">Create a free account</Link></p>
    </div>
  );
}
