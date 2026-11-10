import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="kicker">404</p>
        <h1 className="mt-4 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-muted">The page may have moved, or the link may be wrong.</p>
        <div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/">Home</Link></Button><Button asChild variant="outline"><Link href="/academy">Free academy</Link></Button></div>
      </div>
    </main>
  );
}
