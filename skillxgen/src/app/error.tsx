"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="grid min-h-[70dvh] place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="kicker">Something went wrong</p>
        <h1 className="mt-4 text-3xl font-semibold">We could not load this page</h1>
        <p className="mt-3 text-muted">Please try again. If it keeps happening, contact support{error.digest ? ` and quote reference ${error.digest}` : ""}.</p>
        <Button className="mt-8" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
