import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authProvider } from "@/lib/env";
import { ResetPassword } from "@/components/auth-forms";
import { Alert } from "@/components/ui/card";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (authProvider() !== "local") redirect("/sign-in");
  const { token } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {token && /^[0-9a-f]{64}$/.test(token) ? <ResetPassword token={token} /> : <Alert tone="danger">This reset link is not valid. Request a new one from the sign-in page.</Alert>}
    </div>
  );
}
