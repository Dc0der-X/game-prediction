import Link from "next/link";
import { ArrowUpRight, FileSearch, GraduationCap, MessagesSquare, Route, ShieldCheck, Target } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { listProgrammes } from "@/lib/catalogue";
import { getCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { ArrowLink, Container, CtaBand, Numbered, Section, SectionHeading } from "@/components/site/sections";
import { LogBlock, TriageConsole } from "@/components/site/visuals";
import { Price } from "@/components/site/price";

export default async function HomePage() {
  const viewer = await getViewer().catch(() => null);
  const [programmes, currency, extras] = await Promise.all([
    listProgrammes(viewer), getCurrency(),
    withUser(viewer, async (sql) => ({
      posts: await sql`select slug, title, excerpt, published_at from blog_posts where status = 'published' order by published_at desc limit 3`,
      webinar: (await sql`select id, slug, title, starts_at from webinars where status = 'scheduled' and starts_at > now() order by starts_at limit 1`)[0],
      testimonials: await sql`select person_name, person_title, quote, outcome_type from testimonials where published order by created_at desc limit 3`,
    })),
  ]);
  const main = programmes.filter((p) => p.category === "programme");
  const services = programmes.filter((p) => p.category === "service");

  return (
    <>
      <section className="grid-lines relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_20%,rgba(229,25,43,0.14),transparent)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" aria-hidden />
        <Container className="relative grid items-center gap-14 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <p className="kicker mb-5">Cybersecurity training · USA · UK · Canada</p>
            <h1 className="text-5xl font-semibold leading-[1.02] sm:text-6xl xl:text-7xl">Train. Build.<br /><span className="text-primary">Get Hired.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Practical SOC analyst and penetration testing programmes built around real investigations, written feedback and a portfolio you can defend in an interview.
              Start with free labs — no account, no card.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/courses">Explore programmes</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/academy/soc-labs">Try a free SOC lab</Link></Button>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
              {[["4", "structured programmes"], ["4", "free browser labs"], ["5", "AI career tools"]].map(([n, l]) => (
                <div key={l}><dt className="sr-only">{l}</dt><dd><span className="block text-3xl font-semibold">{n}</span><span className="text-xs text-subtle">{l}</span></dd></div>
              ))}
            </dl>
          </div>
          <TriageConsole />
        </Container>
      </section>

      <section className="border-b border-border bg-surface">
        <Container className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            [ShieldCheck, "No job guarantees", "Nobody can honestly promise you a job. We promise rigorous training and straight feedback."],
            [FileSearch, "Verified outcomes only", "We publish a student result only after checking it and getting written permission."],
            [Target, "Limits stated up front", "Every programme page lists what it will not do, alongside what it will."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex gap-4 py-7 md:px-6 md:first:pl-0">
                <I className="mt-0.5 size-5 shrink-0 text-primary-hover" aria-hidden />
                <div><p className="font-medium">{title as string}</p><p className="mt-1 text-sm text-muted">{body as string}</p></div>
              </div>
            );
          })}
        </Container>
      </section>

      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading kicker="Programmes" title="Pick the route that matches where you are">Each programme is part-time, taught live online and assessed on practical work.</SectionHeading>
          <ArrowLink href="/pricing">Compare pricing</ArrowLink>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
          {main.map((p, i) => (
            <Link key={p.slug} href={`/programmes/${p.slug}`} className="group relative flex flex-col bg-card p-7 transition-colors hover:bg-elevated">
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <ArrowUpRight className="size-5 text-subtle transition-colors group-hover:text-primary-hover" aria-hidden />
              </div>
              <h3 className="mt-6 text-2xl font-semibold">{p.title}</h3>
              <p className="mt-2 text-muted">{p.tagline}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-sm">
                <span className="text-muted">{p.duration.split(",")[0]}</span>
                <Price programme={p} currency={currency} className="font-mono text-foreground" />
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {services.map((p) => (
            <Link key={p.slug} href={`/programmes/${p.slug}`} className="group rounded-lg border border-border p-5 transition-colors hover:border-border-strong">
              <p className="kicker">Career service</p>
              <h3 className="mt-3 font-semibold group-hover:text-primary-hover">{p.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{p.tagline}</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading kicker="How it works" title="Three verbs, in that order" />
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Numbered n={1} title="Train">Short live sessions, then labs against realistic telemetry. You learn a repeatable method, not a list of tool names.</Numbered>
          <Numbered n={2} title="Build">Every assignment is a written investigation or report, graded with feedback. By the end you have a portfolio, not just a certificate.</Numbered>
          <Numbered n={3} title="Get hired">Resume and LinkedIn rebuilt around evidence, mock interviews with written feedback, and coaching through your search. The hiring decision stays with employers — the preparation is on us.</Numbered>
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading kicker="Free learning academy" title="See if you like the work before you spend anything">
              Investigate a phishing email, hunt a password spray in a mini SIEM and review an incident report — all in your browser. Reading is open to everyone; a free account saves your progress.
            </SectionHeading>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild><Link href="/academy">Open the free academy</Link></Button>
              <Button asChild variant="outline"><Link href="/career-assessment">Take the skills assessment</Link></Button>
            </div>
          </div>
          <LogBlock label="auth.log · lab extract" lines={[
            "08:10:02  4625  user=a.reid     src=203.0.113.77  bad password",
            "08:10:31  4625  user=b.singh    src=203.0.113.77  bad password",
            "08:11:04  4625  user=c.mwangi   src=203.0.113.77  bad password",
            "08:11:36  4625  user=d.novak    src=203.0.113.77  bad password",
            "   …      58 more accounts, one attempt each",
            "08:39:12  4624  user=m.chen     src=203.0.113.77  logon_type=3",
            "",
            "# One source. Sixty-one accounts. One success.",
            "# What is this — and what do you check next?",
          ]} />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading kicker="AI career tools" title="Feedback on demand, with the caveats left in">Included with every account. Each tool works with rule-based analysis and adds AI review where a provider is configured.</SectionHeading>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            [FileSearch, "Resume Analyzer", "Upload a PDF or DOCX. Get structural checks, extracted skills and a comparison with a job description.", "/portal/tools/resume-analyzer"],
            [Route, "Career Advisor", "A skills-gap analysis and week-by-week roadmap for your target role.", "/portal/tools/career-advisor"],
            [MessagesSquare, "Interview Coach", "Role-specific technical and behavioural questions with feedback on every answer.", "/portal/tools/interview-coach"],
            [Target, "Job Description Analyser", "Paste a posting to extract required skills, certifications and what to prepare.", "/portal/tools/jd-analyser"],
            [GraduationCap, "Learning Assistant", "Guided SOC, SIEM, phishing, incident response and threat-hunting exercises.", "/portal/tools/learning-assistant"],
          ].map(([Icon, title, body, href]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <Link key={title as string} href={href as string} className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-border-strong">
                <I className="size-5 text-primary-hover" aria-hidden />
                <h3 className="mt-4 font-semibold group-hover:text-primary-hover">{title as string}</h3>
                <p className="mt-1.5 text-sm text-muted">{body as string}</p>
              </Link>
            );
          })}
          <div className="rounded-lg border border-dashed border-border-strong p-6 text-sm text-muted">
            <p className="font-medium text-foreground">What these tools are not</p>
            <p className="mt-1.5">They do not predict hiring decisions or replace human review. Indicators describe structure and overlap, nothing more.</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionHeading kicker="Student outcomes" title="Proof, or nothing">
            We separate four different things that are often blurred together: completing training, passing a certification, succeeding at interview and actually being employed.
            <span className="mt-4 block"><ArrowLink href="/success-stories">How we verify and publish outcomes</ArrowLink></span>
          </SectionHeading>
          {extras.testimonials.length ? (
            <div className="grid gap-4">
              {extras.testimonials.map((t) => (
                <Card key={t.quote}><CardContent>
                  <Badge variant="success">Verified · {String(t.outcome_type).replace(/_/g, " ")}</Badge>
                  <blockquote className="mt-4 text-lg leading-relaxed">“{t.quote}”</blockquote>
                  <p className="mt-4 text-sm text-muted">{t.person_name}{t.person_title ? ` — ${t.person_title}` : ""}</p>
                </CardContent></Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed"><CardContent className="p-8">
              <p className="kicker">Nothing published yet</p>
              <p className="mt-4 text-lg leading-relaxed">We have not published any student outcomes yet, because none have completed our verification process.</p>
              <p className="mt-3 text-muted">When they have, they will appear here with the outcome type labelled. We would rather show an empty space than a quote we cannot stand behind.</p>
            </CardContent></Card>
          )}
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="flex items-end justify-between gap-6"><SectionHeading kicker="Blog and resources" title="Recent writing" /><ArrowLink href="/blog">All articles</ArrowLink></div>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {extras.posts.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group block py-5">
                  <p className="font-mono text-xs text-subtle">{formatDate(p.published_at)}</p>
                  <h3 className="mt-1.5 text-lg font-medium group-hover:text-primary-hover">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
          {extras.webinar ? (
            <Card className="self-start"><CardContent className="p-7">
              <p className="kicker">Next free webinar</p>
              <h3 className="mt-4 text-xl font-semibold">{extras.webinar.title}</h3>
              <p className="mt-2 font-mono text-sm text-muted">{formatDate(extras.webinar.starts_at, true)}</p>
              <Button asChild className="mt-6"><Link href="/webinars">Register free</Link></Button>
            </CardContent></Card>
          ) : null}
        </div>
      </Section>

      <CtaBand title="Not sure which route fits?" primary={{ href: "/contact", label: "Book a consultation" }} secondary={{ href: "/career-assessment", label: "Take the free assessment" }}>
        A 20-minute call with no sales script. If a programme is not right for you, we will say so.
      </CtaBand>
    </>
  );
}
