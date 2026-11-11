import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { SignOut } from "@/components/sign-out";
import { Badge } from "@/components/ui/card";
import { authProvider } from "@/lib/env";
import type { Viewer } from "@/lib/auth";
import { titleCase } from "@/lib/utils";

export type NavGroup = { title: string; items: { href: string; label: string; badge?: number }[] };

function Nav({ groups }: { groups: NavGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="kicker mb-2 px-3 text-subtle">{g.title}</p>
          <ul>
            {g.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-foreground">
                  {i.label}{i.badge ? <Badge variant="primary">{i.badge}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AppShell({ viewer, groups, area, children, switchTo }: { viewer: Viewer; groups: NavGroup[]; area: string; children: React.ReactNode; switchTo?: { href: string; label: string } }) {
  const provider = authProvider();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-border bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-4">
          <Link href="/" className="px-3 py-2" aria-label="SkillXGen home"><Logo /></Link>
          <p className="mb-5 mt-1 px-3 font-mono text-[0.68rem] uppercase tracking-widest text-subtle">{area}</p>
          <nav aria-label={area} className="flex-1"><Nav groups={groups} /></nav>
          <div className="mt-6 border-t border-border pt-4">
            <p className="truncate px-3 text-sm font-medium" data-testid="viewer-name">{viewer.fullName || viewer.email}</p>
            <p className="px-3 font-mono text-[0.68rem] uppercase tracking-wider text-subtle" data-testid="viewer-role">{titleCase(viewer.role)}</p>
            <div className="mt-3 flex flex-col gap-1 px-1">
              {switchTo ? <Link href={switchTo.href} className="rounded-md px-2 py-1.5 text-sm text-muted hover:bg-elevated hover:text-foreground">{switchTo.label}</Link> : null}
              <SignOut provider={provider} />
            </div>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <Link href="/" aria-label="SkillXGen home"><Logo className="text-base" /></Link>
          <details className="group">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border [&::-webkit-details-marker]:hidden" aria-label="Open menu"><Menu className="size-4" aria-hidden /></summary>
            <nav aria-label={`${area} (mobile)`} className="absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border bg-surface p-4">
              <Nav groups={groups} />
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">{switchTo ? <Link href={switchTo.href} className="text-sm text-muted">{switchTo.label}</Link> : null}<SignOut provider={provider} /></div>
            </nav>
          </details>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>{children ? <div className="mt-1.5 max-w-2xl text-muted">{children}</div> : null}</div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
