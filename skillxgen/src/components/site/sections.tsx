import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-8xl px-5 lg:px-8", className)} {...props} />;
}

export function Section({ className, children, id, tone = "default" }: { className?: string; children: React.ReactNode; id?: string; tone?: "default" | "surface" }) {
  return <section id={id} className={cn("border-b border-border py-16 lg:py-24", tone === "surface" && "bg-surface", className)}><Container>{children}</Container></section>;
}

export function SectionHeading({ kicker, title, children, className, as: Tag = "h2" }: { kicker?: string; title: string; children?: React.ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {kicker ? <p className="kicker mb-3">{kicker}</p> : null}
      <Tag className="text-3xl font-semibold leading-[1.1] sm:text-4xl">{title}</Tag>
      {children ? <div className="mt-4 text-lg leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

export function PageHero({ kicker, title, children, actions, aside }: { kicker: string; title: string; children?: React.ReactNode; actions?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="grid-lines relative border-b border-border">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" aria-hidden />
      <Container className={cn("relative py-16 lg:py-24", aside && "grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]")}>
        <div className="max-w-3xl">
          <p className="kicker mb-4">{kicker}</p>
          <h1 className="text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">{title}</h1>
          {children ? <div className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{children}</div> : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside}
      </Container>
    </section>
  );
}

export function CheckList({ items, className, negative = false }: { items: string[]; className?: string; negative?: boolean }) {
  const Icon = negative ? Minus : Check;
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[0.95rem] leading-relaxed text-muted">
          <Icon className={cn("mt-1 size-4 shrink-0", negative ? "text-subtle" : "text-primary-hover")} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <Link href={href} className={cn("group inline-flex items-center gap-1.5 text-sm font-medium text-primary-hover", className)}>{children}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>;
}

export function CtaBand({ title, children, primary, secondary }: { title: string; children: React.ReactNode; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <section className="border-b border-border bg-primary-soft/40">
      <Container className="flex flex-col items-start justify-between gap-8 py-14 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
          <div className="mt-3 text-muted">{children}</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href={primary.href}>{primary.label}</Link></Button>
          {secondary ? <Button asChild size="lg" variant="outline"><Link href={secondary.href}>{secondary.label}</Link></Button> : null}
        </div>
      </Container>
    </section>
  );
}

export function Numbered({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-strong pt-5">
      <p className="font-mono text-xs text-primary-hover">{String(n).padStart(2, "0")}</p>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHero kicker="Legal" title={title}><p className="text-base">Last updated {updated}. This document is a working draft prepared for launch and must be reviewed by a qualified solicitor or attorney before the site goes live.</p></PageHero>
      <Section><div className="prose-sx max-w-3xl">{children}</div></Section>
    </>
  );
}
