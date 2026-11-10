import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { listProgrammes } from "@/lib/catalogue";
import { getCurrency } from "@/lib/currency";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/site/sections";
import { CurrencySwitcher, Price } from "@/components/site/price";

export const metadata: Metadata = { title: "Courses", description: "All SkillXGen cybersecurity programmes, career services and free courses in one place.", alternates: { canonical: "/courses" } };

export default async function CoursesPage() {
  const viewer = await getViewer().catch(() => null);
  const [programmes, currency, courses] = await Promise.all([
    listProgrammes(viewer), getCurrency(),
    withUser(viewer, (sql) => sql`select c.slug, c.title, c.summary, c.level, c.category, c.is_free, c.est_hours, p.title as programme_title, p.slug as programme_slug,
      (select count(*)::int from lesson_outline l where l.course_id = c.id) as lessons
      from courses c left join programmes p on p.id = c.programme_id where c.status = 'published' order by c.is_free desc, c.position`),
  ]);
  return (
    <>
      <PageHero kicker="Courses" title="Everything we teach, in one place">Structured programmes for a first security role, focused career services, and free courses to get you started.</PageHero>
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading kicker="Programmes" title="Structured, instructor-led programmes" /><CurrencySwitcher current={currency} /></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {programmes.filter((p) => p.category === "programme").map((p) => (
            <Card key={p.slug}><CardContent className="flex h-full flex-col p-7">
              <h3 className="text-xl font-semibold"><Link href={`/programmes/${p.slug}`} className="hover:text-primary-hover">{p.title}</Link></h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{p.summary}</p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
                <div><dt className="kicker">Duration</dt><dd className="mt-1 text-muted">{p.duration.split(",")[0]}</dd></div>
                <div><dt className="kicker">Fee</dt><dd className="mt-1 font-mono"><Price programme={p} currency={currency} /></dd></div>
              </dl>
              <ArrowLink href={`/programmes/${p.slug}`} className="mt-5">Programme details</ArrowLink>
            </CardContent></Card>
          ))}
        </div>
      </Section>
      <Section tone="surface">
        <SectionHeading kicker="Career services" title="Focused help for a specific stage" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {programmes.filter((p) => p.category === "service").map((p) => (
            <Card key={p.slug}><CardContent className="flex h-full flex-col">
              <h3 className="font-semibold"><Link href={`/programmes/${p.slug}`} className="hover:text-primary-hover">{p.title}</Link></h3>
              <p className="mt-2 flex-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-4 font-mono text-sm"><Price programme={p} currency={currency} /> <span className="text-subtle">· {p.duration}</span></p>
            </CardContent></Card>
          ))}
        </div>
      </Section>
      <Section>
        <SectionHeading kicker="Individual courses" title="Courses and certification preparation">Free courses are open to everyone. Other courses are included with the programme shown.</SectionHeading>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {courses.map((c) => (
            <div key={c.slug} className="grid items-center gap-3 py-5 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold"><Link href={`/academy/courses/${c.slug}`} className="hover:text-primary-hover">{c.title}</Link></h3>
                  {c.is_free ? <Badge variant="success">Free</Badge> : <Badge>Included in {c.programme_title}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">{c.summary}</p>
              </div>
              <p className="font-mono text-xs text-subtle">{c.lessons} lessons · {c.level}</p>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand title="Start free" primary={{ href: "/academy", label: "Open the free academy" }} secondary={{ href: "/contact", label: "Talk to us" }}>The SOC Analyst Foundations course and four browser labs cost nothing and need no account.</CtaBand>
    </>
  );
}
