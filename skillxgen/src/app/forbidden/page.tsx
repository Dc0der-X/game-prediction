import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="kicker">403</p>
        <h1 className="mt-4 text-3xl font-semibold">You do not have access to that area</h1>
        <p className="mt-3 text-muted">Your account does not include the permission needed for this page. If you think that is a mistake, contact an administrator.</p>
        <div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/portal">Go to dashboard</Link></Button><Button asChild variant="outline"><Link href="/">Home</Link></Button></div>
      </div>
    </main>
  );
}
