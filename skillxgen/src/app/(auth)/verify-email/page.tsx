import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authProvider } from "@/lib/env";
import { verifyEmailLocal } from "@/lib/auth/local";
import { rateLimitByIp } from "@/lib/security";
import { Alert } from "@/components/ui/card";
import { ResendVerification } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string; email?: string }> }) {
  if (authProvider() !== "local") redirect("/sign-in");
  const sp = await searchParams;
  if (sp.token) {
    const allowed = (await rateLimitByIp("auth:verify", 20, 3600)).ok;
    if (allowed && (await verifyEmailLocal(sp.token))) redirect("/sign-in?verified=1");
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">Link not valid</h1>
        <Alert tone="danger">This verification link is invalid, has expired or was already used.</Alert>
        <ResendVerification />
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <Alert tone="success" data-testid="verify-sent">If the address is new to us, we have sent a verification link{sp.email ? <> to <strong>{sp.email}</strong></> : null}. It expires in 24 hours.</Alert>
      <p className="text-sm text-muted">Nothing arrived? Check spam, or request another link.</p>
      <ResendVerification email={sp.email} />
      <p className="text-sm text-muted"><Link href="/sign-in" className="text-primary-hover hover:underline">Back to sign in</Link></p>
    </div>
  );
}
