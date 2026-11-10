import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { Logo } from "./logo";
import { ACADEMY_LINKS, MAIN_LINKS, PROGRAMME_LINKS, SERVICE_LINKS } from "./nav";
import { Button } from "@/components/ui/button";
import { can, type Viewer } from "@/lib/auth";

function Dropdown({ label, groups }: { label: string; groups: { title: string; links: { href: string; label: string; note: string }[] }[] }) {
  return (
    <div className="group relative">
      <button type="button" className="flex items-center gap-1 px-3 py-2 text-sm text-muted transition-colors hover:text-foreground group-focus-within:text-foreground cursor-pointer" aria-haspopup="true">
        {label}<ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" aria-hidden />
      </button>
      <div className="invisible absolute left-0 top-full z-40 w-max max-w-[44rem] translate-y-1 pt-2 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        <div className="flex gap-8 rounded-lg border border-border-strong bg-surface p-5 shadow-2xl shadow-black/60">
          {groups.map((g) => (
            <div key={g.title} className="w-72">
              <p className="kicker mb-3">{g.title}</p>
              <ul className="space-y-1">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="block rounded-md px-3 py-2 transition-colors hover:bg-elevated">
                      <span className="block text-sm font-medium">{l.label}</span>
                      <span className="block text-xs text-subtle">{l.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  const account = viewer
    ? <Button asChild size="sm" variant="outline"><Link href={can(viewer, "admin.access") ? "/admin" : "/portal"}>{can(viewer, "admin.access") ? "Admin" : "Dashboard"}</Link></Button>
    : <Button asChild size="sm" variant="ghost"><Link href="/sign-in">Sign in</Link></Button>;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-8xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/" aria-label="SkillXGen home"><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center lg:flex">
          <Dropdown label="Programmes" groups={[{ title: "Programmes", links: PROGRAMME_LINKS }, { title: "Career services", links: SERVICE_LINKS }]} />
          <Dropdown label="Free academy" groups={[{ title: "Learn for free", links: ACADEMY_LINKS }]} />
          {MAIN_LINKS.map((l) => <Link key={l.href} href={l.href} className="px-3 py-2 text-sm text-muted transition-colors hover:text-foreground">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {account}
          <Button asChild size="sm"><Link href="/contact">Book a consultation</Link></Button>
        </div>
        <details className="group lg:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-border [&::-webkit-details-marker]:hidden" aria-label="Open menu"><Menu className="size-5" aria-hidden /></summary>
          <nav aria-label="Mobile" className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-surface px-5 py-5">
            {[{ title: "Programmes", links: PROGRAMME_LINKS }, { title: "Career services", links: SERVICE_LINKS }, { title: "Free academy", links: ACADEMY_LINKS }].map((g) => (
              <div key={g.title} className="mb-5">
                <p className="kicker mb-2">{g.title}</p>
                {g.links.map((l) => <Link key={l.href} href={l.href} className="block py-2 text-sm">{l.label}</Link>)}
              </div>
            ))}
            <p className="kicker mb-2">Company</p>
            {[...MAIN_LINKS, { href: "/faq", label: "FAQ" }, { href: "/contact", label: "Contact" }].map((l) => <Link key={l.href} href={l.href} className="block py-2 text-sm">{l.label}</Link>)}
            <div className="mt-5 flex gap-2">{account}<Button asChild size="sm"><Link href="/contact">Book a consultation</Link></Button></div>
          </nav>
        </details>
      </div>
    </header>
  );
}
