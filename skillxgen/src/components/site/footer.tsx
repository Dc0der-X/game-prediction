import Link from "next/link";
import { Logo } from "./logo";
import { ACADEMY_LINKS, PROGRAMME_LINKS, SERVICE_LINKS } from "./nav";

const COMPANY = [
  { href: "/about", label: "About SkillXGen" }, { href: "/success-stories", label: "Student success stories" }, { href: "/blog", label: "Blog and resources" },
  { href: "/pricing", label: "Pricing" }, { href: "/faq", label: "FAQ" }, { href: "/contact", label: "Contact" },
];
const LEGAL = [{ href: "/privacy", label: "Privacy Policy" }, { href: "/terms", label: "Terms and Conditions" }, { href: "/refund-policy", label: "Refund Policy" }];

export function SiteFooter() {
  const col = (title: string, links: { href: string; label: string }[]) => (
    <div>
      <p className="kicker mb-4">{title}</p>
      <ul className="space-y-2.5">{links.map((l) => <li key={l.href}><Link href={l.href} className="text-sm text-muted transition-colors hover:text-foreground">{l.label}</Link></li>)}</ul>
    </div>
  );
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-8xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted">Cybersecurity training and career development for learners in the USA, UK and Canada.</p>
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-subtle">Train. Build. Get Hired.</p>
          </div>
          {col("Programmes", PROGRAMME_LINKS)}
          {col("Career services", SERVICE_LINKS)}
          {col("Free academy", ACADEMY_LINKS)}
          {col("Company", COMPANY)}
        </div>
        <div className="mt-12 border-t border-border pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-subtle">
            SkillXGen provides education and coaching. We do not guarantee employment, interviews, salaries or certification results, and we only publish student outcomes that have been verified and shared with permission.
            SkillXGen is not affiliated with any certification body; all trademarks belong to their owners.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-subtle">© {new Date().getFullYear()} SkillXGen. All rights reserved.</p>
            <ul className="flex flex-wrap gap-5">{LEGAL.map((l) => <li key={l.href}><Link href={l.href} className="text-xs text-muted hover:text-foreground">{l.label}</Link></li>)}</ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
