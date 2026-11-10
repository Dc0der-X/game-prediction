import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="grid-lines relative hidden flex-col justify-between border-r border-border bg-surface p-12 lg:flex">
        <Link href="/" aria-label="SkillXGen home"><Logo /></Link>
        <div>
          <p className="kicker">Train. Build. Get Hired.</p>
          <p className="mt-4 max-w-md text-3xl font-semibold leading-tight">Your labs, feedback and career tools in one place.</p>
          <p className="mt-4 max-w-md text-muted">Save progress through the free SOC labs, upload a resume for a structured review, and practise interviews against real job descriptions.</p>
        </div>
        <p className="font-mono text-xs text-subtle">We never promise job outcomes. We publish only verified results.</p>
      </aside>
      <main id="main" className="flex flex-col items-center justify-center px-5 py-12">
        <Link href="/" className="mb-8 lg:hidden" aria-label="SkillXGen home"><Logo /></Link>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
