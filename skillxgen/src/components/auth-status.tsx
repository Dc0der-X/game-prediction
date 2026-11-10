import Link from "next/link";
import { Alert } from "@/components/ui/card";

export function AuthNotConfigured() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Accounts are not available yet</h1>
      <Alert tone="warning">
        Authentication has not been configured for this deployment. An administrator needs to add the Clerk keys
        (<code className="font-mono">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code className="font-mono">CLERK_SECRET_KEY</code>).
      </Alert>
      <p className="text-sm text-muted">The free academy, labs and resources are open without an account. <Link href="/academy" className="text-primary-hover hover:underline">Browse the free academy</Link>.</p>
    </div>
  );
}
