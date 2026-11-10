import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { LABS } from "@/content/labs";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { ArrowLink, CtaBand, PageHero, Section, SectionHeading } from "@/components/site/sections";
import { AttackChain } from "@/components/site/visuals";
import { ResourceUpdatesForm } from "@/components/site/lead-forms";

export const metadata: Metadata = { title: "Free Learning Academy", description: "Free SOC analyst course, hands-on labs, career roadmap, resume checklist and interview question bank. No payment and no account required.", alternates: { canonical: "/academy" } };

export default async function AcademyPage() {
  const viewer = await getViewer().catch(() => null);
  const { courses, resources, webinar } = await withUser(viewer, async (sql) => ({
    courses: await sql`select c.slug, c.title, c.summary, c.est_hours, (select count(*)::int from lesson_outline l where l.course_id = c.id) as lessons from courses c where c.is_free and c.status = 'published' order by c.position`,
    resources: await sql`select slug, title, description, kind from resources where status = 'published' order by position`,
    webinar: (await sql`select title, starts_at from webinars where status = 'scheduled' and starts_at > now() order by starts_at limit 1`)[0],
  }));
  return (
    <>
      <PageHero kicker="Free learning academy" title="Learn real SOC skills for free"
        actions={<><Button asChild size="lg"><Link href={`/academy/courses/${courses[0]?.slug ?? ""}`}>Start the free course</Link></Button><Button asChild size="lg" variant="outline"><Link href="/academy/soc-labs">Go to the labs</Link></Button></>}>
        A complete introductory course, four hands-on investigations and practical career guides. Everything on this page is free. You only need an account if you want to save progress.
      </PageHero>

      <Section>
        <SectionHeading kicker="Free course" title="Start with the foundations" />
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          {courses.map((c) => (
            <Card key={c.slug}><CardContent className="p-7">
              <Badge variant="success">Free · {c.lessons} lessons · about {Number(c.est_hours)} hours</Badge>
              <h3 className="mt-4 text-2xl font-semibold">{c.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{c.summary}</p>
              <Button asChild className="mt-6"><Link href={`/academy/courses/${c.slug}`}>Open course</Link></Button>
            </CardContent></Card>
          ))}
          <div className="rounded-lg border border-border p-6">
            <p className="kicker mb-4">You will learn to think in sequences</p>
            <AttackChain className="lg:grid-cols-2" />
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading kicker="Free SOC labs" title="Investigate in your browser">Each lab gives you raw evidence and asks you to reach a verdict, with an explanation for every answer.</SectionHeading><ArrowLink href="/academy/soc-labs">All labs</ArrowLink></div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {LABS.map((l, i) => (
            <Link key={l.slug} href={`/academy/soc-labs/${l.slug}`} className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-border-strong">
              <p className="font-mono text-xs text-subtle">LAB {String(i + 1).padStart(2, "0")} · {l.minutes} min · {l.level}</p>
              <h3 className="mt-3 text-lg font-semibold group-hover:text-primary-hover">{l.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{l.summary}</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6"><SectionHeading kicker="Guides and downloads" title="Career resources" /><ArrowLink href="/academy/resources">All resources</ArrowLink></div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <Link key={r.slug} href={`/academy/resources/${r.slug}`} className="group rounded-lg border border-border p-6 transition-colors hover:border-border-strong">
              <Badge>{r.kind}</Badge>
              <h3 className="mt-3 font-semibold group-hover:text-primary-hover">{r.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{r.description}</p>
            </Link>
          ))}
          <Link href="/career-assessment" className="group rounded-lg border border-primary/50 bg-primary-soft/40 p-6">
            <Badge variant="primary">5 minutes</Badge>
            <h3 className="mt-3 font-semibold group-hover:text-primary-hover">Career skills assessment</h3>
            <p className="mt-1.5 text-sm text-muted">See your gap against a target role and get next steps.</p>
          </Link>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading kicker="Stay in the loop" title="New free labs by email">Optional. We send new labs, guides and webinar dates occasionally. No daily emails and no pressure.</SectionHeading>
            {webinar ? <p className="mt-6 text-sm text-muted">Next free webinar: <Link href="/webinars" className="text-primary-hover hover:underline">{webinar.title}</Link></p> : null}
          </div>
          <ResourceUpdatesForm resource="Free academy updates" />
        </div>
      </Section>

      <CtaBand title="Ready for structure and feedback?" primary={{ href: "/programmes/soc-analyst", label: "SOC Analyst Programme" }} secondary={{ href: "/contact", label: "Ask a question" }}>
        When the free material starts to feel easy, the SOC Analyst Programme adds graded investigations, instructor feedback and career preparation. No rush.
      </CtaBand>
    </>
  );
}
