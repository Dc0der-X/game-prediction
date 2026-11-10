import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { withUser, service } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { CtaBand, Numbered, PageHero, Section, SectionHeading } from "@/components/site/sections";

export const metadata: Metadata = { title: "Student Success Stories", description: "Verified student outcomes from SkillXGen, and how we verify them.", alternates: { canonical: "/success-stories" } };

const TYPES = [
  ["training_completion", "Training completion", "The learner finished a SkillXGen programme and met its assessment standard. Verified from our own records."],
  ["certification", "Certification achievement", "The learner passed an external certification exam. Verified from the certifying body's record or certificate."],
  ["interview_success", "Interview success", "The learner progressed through an employer's interview process. Verified from correspondence they share with us."],
  ["placement", "Employment placement", "The learner started a paid role. Verified from an offer letter, contract or employer confirmation."],
] as const;
const LABEL = Object.fromEntries(TYPES.map(([k, l]) => [k, l]));

export default async function SuccessStoriesPage() {
  const viewer = await getViewer().catch(() => null);
  const data = await withUser(viewer, async (sql) => ({
    testimonials: await sql`select t.*, p.title as programme_title from testimonials t left join programmes p on p.id = t.programme_id where t.published order by t.verified_at desc nulls last`,
    cases: await sql`select * from case_studies where published order by verified_at desc nulls last`,
    proof: await sql`select * from proof_items where published order by issued_on desc nulls last, created_at desc`,
  }));
  // Completion statistics are only shown when an admin has switched them on, and are computed from real enrolment records.
  const sql = service();
  const [setting] = await sql`select value from settings where key = 'proof'`;
  const stats = setting?.value?.publish_completion_stats
    ? (await sql`select count(*) filter (where status in ('active','completed'))::int as enrolled, count(*) filter (where status = 'completed')::int as completed from enrolments where programme_id is not null`)[0]
    : null;
  const empty = !data.testimonials.length && !data.cases.length && !data.proof.length;
  const credentials = data.proof.filter((p) => p.kind === "instructor_credential");
  const outcomes = data.proof.filter((p) => p.kind !== "instructor_credential");

  return (
    <>
      <PageHero kicker="Student success stories" title="Only what we can verify">
        Every outcome on this page has been checked against evidence and published with the learner&apos;s written permission. We label exactly what each one is, because completing a course, passing an exam, doing well at interview and being hired are four different things.
      </PageHero>

      <Section>
        <SectionHeading kicker="What the labels mean" title="Four kinds of outcome" />
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(([, label, desc], i) => <Numbered key={label} n={i + 1} title={label}>{desc}</Numbered>)}
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading kicker="Published outcomes" title={empty ? "Nothing published yet" : "Verified stories"} />
        {empty ? (
          <Card className="mt-10 border-dashed"><CardContent className="p-8">
            <p className="max-w-2xl text-lg leading-relaxed">No student outcomes have completed verification yet, so this section is empty.</p>
            <p className="mt-3 max-w-2xl text-muted">We know an empty page is unusual. We would rather earn your trust with free material you can judge for yourself than fill this space with claims you cannot check. Stories will appear here as learners finish, as we verify their results, and as they agree to share them.</p>
          </CardContent></Card>
        ) : (
          <div className="mt-10 space-y-10">
            {data.testimonials.length ? (
              <div className="grid gap-5 md:grid-cols-2">
                {data.testimonials.map((t) => (
                  <Card key={t.id}><CardContent className="p-7">
                    <Badge variant="success">Verified · {LABEL[t.outcome_type] ?? "Feedback"}</Badge>
                    <blockquote className="mt-4 text-lg leading-relaxed">“{t.quote}”</blockquote>
                    <p className="mt-4 text-sm text-muted">{t.person_name}{t.person_title ? ` — ${t.person_title}` : ""}{t.programme_title ? ` · ${t.programme_title}` : ""}</p>
                  </CardContent></Card>
                ))}
              </div>
            ) : null}
            {data.cases.map((c) => (
              <Card key={c.id}><CardContent className="p-7">
                <Badge variant="success">Verified case study · {LABEL[c.outcome_type]}</Badge>
                <h3 className="mt-4 text-2xl font-semibold">{c.title}</h3>
                <p className="mt-2 text-muted">{c.summary}</p>
                {c.body ? <Markdown className="mt-5">{c.body}</Markdown> : null}
              </CardContent></Card>
            ))}
            {outcomes.length ? (
              <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {outcomes.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border bg-card p-5">
                    <Badge variant="success">Verified · {String(p.kind).replace(/_/g, " ")}</Badge>
                    <p className="mt-3 font-medium">{p.title}</p>
                    <p className="mt-1 text-sm text-muted">{p.person_name}{p.issued_on ? ` · ${formatDate(p.issued_on)}` : ""}</p>
                    {p.description ? <p className="mt-2 text-sm text-muted">{p.description}</p> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {stats ? (
          <p className="mt-10 font-mono text-sm text-muted">Programme records to date: {stats.enrolled} enrolled, {stats.completed} completed. Figures are counted from enrolment records, not estimated.</p>
        ) : null}
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading kicker="Verified instructor credentials" title="Who teaches" />
            {credentials.length ? (
              <ul className="mt-8 space-y-4">
                {credentials.map((c) => <li key={c.id} className="rounded-lg border border-border p-5"><Badge variant="success">Verified</Badge><p className="mt-3 font-medium">{c.person_name}</p><p className="text-sm text-muted">{c.title}</p>{c.description ? <p className="mt-2 text-sm text-muted">{c.description}</p> : null}</li>)}
              </ul>
            ) : <p className="mt-6 text-muted">Instructor profiles are published here once their experience and certifications have been verified. Ask us on a consultation call who will teach your cohort.</p>}
          </div>
          <div>
            <SectionHeading kicker="Our verification process" title="How a story gets published" />
            <ol className="mt-6 list-decimal space-y-3 pl-5 text-muted">
              <li>The learner tells us about an outcome and offers to share it.</li>
              <li>We ask for evidence appropriate to the outcome type and record what we saw.</li>
              <li>A second member of staff marks it verified.</li>
              <li>The learner approves the exact wording in writing and can withdraw consent at any time — we then remove it.</li>
            </ol>
            <p className="mt-6 text-sm text-subtle">Our publishing system enforces this: an item cannot be made public unless consent is recorded and it is marked verified.</p>
          </div>
        </div>
      </Section>
      <CtaBand title="Judge the teaching, not the marketing" primary={{ href: "/academy", label: "Try the free academy" }} secondary={{ href: "/contact", label: "Talk to us" }}>Start with a free lab and decide for yourself.</CtaBand>
    </>
  );
}
