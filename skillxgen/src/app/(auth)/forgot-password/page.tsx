import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authProvider } from "@/lib/env";
import { ForgotPassword } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  if (authProvider() !== "local") redirect("/sign-in");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Reset your password</h1><p className="mt-1 text-sm text-muted">Enter your email and we will send a link to choose a new password.</p></div>
      <ForgotPassword />
      <p className="text-sm text-muted"><Link href="/sign-in" className="text-primary-hover hover:underline">Back to sign in</Link></p>
    </div>
  );
}
