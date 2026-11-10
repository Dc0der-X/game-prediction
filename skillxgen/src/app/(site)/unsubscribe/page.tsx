import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribe } from "@/lib/crm";
import { rateLimitByIp } from "@/lib/security";
import { Alert } from "@/components/ui/card";
import { Container } from "@/components/site/sections";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

async function confirm(fd: FormData) {
  "use server";
  const { redirect } = await import("next/navigation");
  const token = String(fd.get("token") ?? "");
  const allowed = (await rateLimitByIp("unsubscribe", 20, 3600)).ok;
  redirect(`/unsubscribe?done=${allowed && (await unsubscribe(token)) ? "1" : "0"}`);
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  return (
    <Container className="max-w-xl py-24">
      <h1 className="text-3xl font-semibold">Email preferences</h1>
      {done === "1" ? <Alert tone="success" className="mt-6" data-testid="unsubscribed">You have been unsubscribed from SkillXGen marketing email. You will still receive messages about your own account, purchases and enquiries.</Alert>
        : done === "0" ? <Alert tone="danger" className="mt-6">That unsubscribe link is not valid. Use the link in the most recent email, or <Link href="/contact" className="underline">contact us</Link>.</Alert>
        : token && /^[0-9a-f]{64}$/.test(token) ? (
          <form action={confirm} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <p className="text-muted">Confirm that you no longer want to receive marketing email from SkillXGen.</p>
            <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover cursor-pointer">Unsubscribe</button>
          </form>
        ) : <Alert tone="warning" className="mt-6">Open this page from the unsubscribe link in one of our emails.</Alert>}
    </Container>
  );
}
