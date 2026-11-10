import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getProgramme } from "@/lib/catalogue";
import { getCurrency } from "@/lib/currency";
import { paymentsProvider, siteUrl } from "@/lib/env";
import { priceFor } from "@/lib/payments/pricing";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { CheckList, Container, CtaBand, Section, SectionHeading } from "@/components/site/sections";
import { AttackChain, TopologyGraphic, TriageConsole } from "@/components/site/visuals";
import { CurrencySwitcher, Price } from "@/components/site/price";
import { EnrolForm } from "@/components/site/enrol";
import { EnquiryForm } from "@/components/site/lead-forms";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ checkout?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProgramme(null, slug);
  if (!p) return {};
  return { title: p.title, description: p.summary, alternates: { canonical: `/programmes/${p.slug}` }, openGraph: { title: p.title, description: p.summary, url: `/programmes/${p.slug}` } };
}

export default async function ProgrammePage({ params, searchParams }: Props) {
  const [{ slug }, sp, viewer, currency] = await Promise.all([params, searchParams, getViewer().catch(() => null), getCurrency()]);
  const p = await getProgramme(viewer, slug);
  if (!p) notFound();
  const [enrolled, credentials] = await withUser(viewer, async (sql) => [
    viewer ? (await sql`select 1 from enrolments where user_id = ${viewer.id} and programme_id = ${p.id} and status in ('active', 'completed')`).length > 0 : false,
    await sql`select title, person_name, description from proof_items where kind = 'instructor_credential' and published order by created_at desc limit 4`,
  ] as const);
  const amount = priceFor(p, currency);
  const canPay = amount != null && paymentsProvider() !== "unconfigured";
  const visual = slug === "penetration-testing" ? <TopologyGraphic /> : slug === "soc-analyst" || slug === "career-transition" ? <TriageConsole /> : null;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Course", name: p.title, description: p.summary, url: `${siteUrl()}/programmes/${p.slug}`,
    provider: { "@type": "Organization", name: "SkillXGen", url: siteUrl() },
    ...(p.price_usd && !p.enquiry_only ? { offers: { "@type": "Offer", price: (p.price_usd / 100).toFixed(2), priceCurrency: "USD", category: "Paid" } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="grid-lines relative border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-background" aria-hidden />
        <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="kicker mb-4">{p.category === "service" ? "Career service" : "Programme"} · {p.duration.split(",")[0]}</p>
            <h1 className="text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">{p.title}</h1>
            <p className="mt-5 max-w-2xl text-xl text-foreground/90">{p.tagline}</p>
            <p className="mt-4 max-w-2xl leading-relaxed text-muted">{p.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><a href="#enrol">{p.enquiry_only ? "Request a consultation" : enrolled ? "You are enrolled" : "Enrol or enquire"}</a></Button>
              <Button asChild size="lg" variant="outline"><a href="#curriculum">View curriculum</a></Button>
            </div>
          </div>
          {visual ?? (
            <Card><CardContent className="space-y-4 p-7">
              {[["Duration", p.duration], ["Format", p.delivery_format]].map(([k, v]) => <div key={k}><p className="kicker">{k}</p><p className="mt-1.5 text-sm text-muted">{v}</p></div>)}
            </CardContent></Card>
          )}
        </Container>
      </section>

      {sp.checkout === "cancelled" ? <Container className="pt-8"><Alert tone="warning">Checkout was cancelled. No payment was taken.</Alert></Container> : null}

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeading kicker="Programme overview" title="What this is" />
            <Markdown className="mt-6 max-w-2xl">{p.overview}</Markdown>
          </div>
          <dl className="grid content-start gap-px overflow-hidden rounded-lg border border-border bg-border">
            {[["Duration", p.duration], ["Delivery format", p.delivery_format], ["Price", null]].map(([k, v]) => (
              <div key={k as string} className="bg-card p-5">
                <dt className="kicker">{k}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{v ?? <Price programme={p} currency={currency} className="text-2xl font-semibold text-foreground" />}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-12 md:grid-cols-2">
          <div><SectionHeading kicker="Intended audience" title="Who it is for" as="h2" /><CheckList items={p.audience} className="mt-6" /></div>
          <div><SectionHeading kicker="Prerequisites" title="What you need first" as="h2" /><CheckList items={p.prerequisites} className="mt-6" /></div>
        </div>
      </Section>

      <Section id="curriculum">
        <SectionHeading kicker="Curriculum" title="What you will study" />
        {slug === "soc-analyst" ? <AttackChain className="mt-8" /> : null}
        <ol className="mt-10 divide-y divide-border border-y border-border">
          {p.curriculum.map((m, i) => (
            <li key={m.title} className="grid gap-4 py-6 md:grid-cols-[5rem_1fr_1.4fr]">
              <span className="font-mono text-sm text-primary-hover">{String(i + 1).padStart(2, "0")}</span>
              <div><h3 className="text-lg font-semibold">{m.title}</h3><p className="mt-1 font-mono text-xs text-subtle">{m.weeks}</p></div>
              <ul className="space-y-1.5 text-sm text-muted">{m.topics.map((t) => <li key={t}>— {t}</li>)}</ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="surface">
        <div className="grid gap-12 md:grid-cols-2">
          <div><SectionHeading kicker="Learning outcomes" title="By the end you can" /><CheckList items={p.outcomes} className="mt-6" /></div>
          <div>
            <SectionHeading kicker="Practical projects" title="What you will build" />
            <div className="mt-6 space-y-4">
              {p.projects.map((pr) => <Card key={pr.title}><CardContent><h3 className="font-semibold">{pr.title}</h3><p className="mt-1.5 text-sm text-muted">{pr.description}</p></CardContent></Card>)}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div><SectionHeading kicker="Deliverables" title="What you receive" /><CheckList items={p.deliverables} className="mt-6" /></div>
          <div>
            <SectionHeading kicker="Instructor information" title="Who teaches it" />
            <Markdown className="mt-6 text-[0.95rem]">{p.instructor_info}</Markdown>
            {credentials.length ? (
              <ul className="mt-5 space-y-3">
                {credentials.map((c) => <li key={c.title} className="rounded-md border border-border p-4"><Badge variant="success">Verified</Badge><p className="mt-2 font-medium">{c.person_name}</p><p className="text-sm text-muted">{c.title}{c.description ? ` — ${c.description}` : ""}</p></li>)}
              </ul>
            ) : null}
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading kicker="Honest limitations" title="What this programme will not do">We would rather you know now than feel misled later.</SectionHeading>
          <CheckList items={p.limitations} negative />
        </div>
      </Section>

      <Section id="enrol">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading kicker={p.enquiry_only ? "Enrol by consultation" : "Pricing"} title={p.enquiry_only ? "Talk to us first" : "Enrol"}>
              {p.enquiry_only ? "This service starts with a short call so we can confirm it is the right fit before you pay anything." : "One payment covers the full programme. Prices are shown in your chosen currency; you are charged in that currency."}
            </SectionHeading>
            {!p.enquiry_only ? (
              <Card className="mt-8"><CardContent className="p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div><p className="kicker">Programme fee</p><p className="mt-2 text-4xl font-semibold"><Price programme={p} currency={currency} /></p></div>
                  <CurrencySwitcher current={currency} />
                </div>
                <div className="mt-6 border-t border-border pt-6">
                  {enrolled ? <Alert tone="success">You are enrolled. <Link href="/portal/learning" className="underline">Go to your learning</Link>.</Alert>
                    : canPay ? <EnrolForm programme={p.slug} currency={currency} signedIn={!!viewer} />
                    : <Alert tone="info">Online payment is not switched on yet. Send an enquiry and we will help you enrol.</Alert>}
                </div>
              </CardContent></Card>
            ) : null}
          </div>
          <div>
            <h3 className="text-xl font-semibold">{p.enquiry_only ? "Request a consultation" : "Questions before you commit?"}</h3>
            <p className="mb-6 mt-2 text-sm text-muted">Tell us where you are now. We reply within two working days — and if this is not the right fit, we will say so.</p>
            <EnquiryForm kind={p.enquiry_only ? "consultation_request" : "programme_enquiry"} programme={p.title} />
          </div>
        </div>
      </Section>

      <CtaBand title="Want to try before you decide?" primary={{ href: "/academy/soc-labs", label: "Open the free SOC labs" }} secondary={{ href: "/career-assessment", label: "Take the skills assessment" }}>
        The free academy shows you what the work feels like, with no account needed.
      </CtaBand>
    </>
  );
}
