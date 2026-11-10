import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { authProvider } from "@/lib/env";
import { getViewer } from "@/lib/auth";
import { LocalSignUp } from "@/components/auth-forms";
import { AuthNotConfigured } from "@/components/auth-status";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignUpPage() {
  const provider = authProvider();
  if (provider !== "unconfigured" && (await getViewer())) redirect("/portal");
  if (provider === "unconfigured") return <AuthNotConfigured />;
  if (provider === "clerk") return <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/portal" />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Create your free account</h1><p className="mt-1 text-sm text-muted">Save lab progress and use the career tools. No payment details needed.</p></div>
      <LocalSignUp />
      <p className="text-sm text-muted">Already registered? <Link href="/sign-in" className="text-primary-hover hover:underline">Sign in</Link></p>
    </div>
  );
}
