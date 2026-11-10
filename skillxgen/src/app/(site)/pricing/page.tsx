import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { listProgrammes } from "@/lib/catalogue";
import { getCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckList, CtaBand, PageHero, Section, SectionHeading } from "@/components/site/sections";
import { CurrencySwitcher, Price } from "@/components/site/price";

export const metadata: Metadata = { title: "Pricing", description: "Transparent pricing for SkillXGen programmes and career services in USD, GBP and CAD.", alternates: { canonical: "/pricing" } };

export default async function PricingPage() {
  const [programmes, currency] = await Promise.all([listProgrammes(await getViewer().catch(() => null)), getCurrency()]);
  return (
    <>
      <PageHero kicker="Pricing" title="One price per programme. No hidden extras.">
        Fees are shown in US dollars, pounds sterling or Canadian dollars, and you are charged in the currency you choose. Certification exam vouchers are not included unless stated.
      </PageHero>
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading kicker="Programmes" title="Instructor-led programmes" /><CurrencySwitcher current={currency} /></div>
        <div className="mt-10 grid gap-5 lg:grid-cols-4 md:grid-cols-2">
          {programmes.filter((p) => p.category === "programme").map((p) => (
            <Card key={p.slug} className={p.slug === "soc-analyst" ? "border-primary/60" : ""}><CardContent className="flex h-full flex-col p-6">
              {p.slug === "soc-analyst" ? <p className="kicker mb-3">Most common starting point</p> : <p className="kicker mb-3 text-subtle">&nbsp;</p>}
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-4 text-4xl font-semibold"><Price programme={p} currency={currency} /></p>
              <p className="mt-1 font-mono text-xs text-subtle">{p.duration.split(",")[0]} · one payment</p>
              <CheckList items={p.deliverables.slice(0, 4)} className="mt-6 flex-1 [&_li]:text-sm" />
              <Button asChild className="mt-6" variant={p.slug === "soc-analyst" ? "default" : "outline"}><Link href={`/programmes/${p.slug}#enrol`}>View and enrol</Link></Button>
            </CardContent></Card>
          ))}
        </div>
      </Section>
      <Section tone="surface">
        <SectionHeading kicker="Career services" title="Shorter, focused services" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {programmes.filter((p) => p.category === "service").map((p) => (
            <Card key={p.slug}><CardContent className="flex h-full flex-col p-6">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-3 text-3xl font-semibold"><Price programme={p} currency={currency} /></p>
              <p className="mt-1 font-mono text-xs text-subtle">{p.duration}</p>
              <p className="mt-4 flex-1 text-sm text-muted">{p.tagline}</p>
              <Button asChild className="mt-6" variant="outline"><Link href={`/programmes/${p.slug}#enrol`}>{p.enquiry_only ? "Request a consultation" : "View and enrol"}</Link></Button>
            </CardContent></Card>
          ))}
        </div>
      </Section>
      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <SectionHeading kicker="Free" title="What costs nothing" />
            <CheckList className="mt-6" items={["SOC Analyst Foundations course (8 lessons)", "Four browser-based SOC labs", "Career roadmap, resume checklist, interview question bank and sample incident report", "Career skills assessment", "Live webinars", "A free account with the AI career tools"]} />
          </div>
          <div>
            <SectionHeading kicker="Good to know" title="Before you pay" />
            <CheckList className="mt-6" negative items={["We do not offer job guarantees or income-share agreements.", "Certification exam fees are paid to the certifying body, not to us.", "Refunds follow the published Refund Policy — read it before enrolling.", "Prices can change for future cohorts; you pay the price shown when you enrol."]} />
            <p className="mt-6 text-sm"><Link href="/refund-policy" className="text-primary-hover hover:underline">Read the Refund Policy</Link></p>
          </div>
        </div>
      </Section>
      <CtaBand title="Unsure what to choose?" primary={{ href: "/contact", label: "Book a consultation" }} secondary={{ href: "/career-assessment", label: "Free skills assessment" }}>We will recommend the smallest thing that gets you to your goal — including the free material.</CtaBand>
    </>
  );
}
