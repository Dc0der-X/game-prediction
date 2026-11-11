import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { certLabel, skillLabel } from "@/lib/career/taxonomy";
import { matchJob, type ParsedResume } from "@/lib/career/resume";
import type { ParsedJob } from "@/lib/career/jd";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, Progress } from "@/components/ui/card";

export const metadata = { title: "Job description analysis" };
type Stored = ParsedJob & { ai?: { summary: string; hiddenExpectations: string[]; questionsToAsk: string[] } | null; note?: string | null; engine?: string };

export default async function JdResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/tools/jd-analyser/${id}`);
  const { jd, resume } = await withUser(viewer, async (sql) => ({
    jd: (await sql`select title, company, parsed, created_at from job_descriptions where id = ${id}`)[0],
    resume: (await sql`select parsed, created_at from resumes where user_id = ${viewer.id} order by created_at desc limit 1`)[0],
  }));
  if (!jd) notFound();
  const j = jd.parsed as Stored;
  const match = resume ? matchJob(resume.parsed as ParsedResume, j) : null;
  return (
    <div data-testid="jd-analysis">
      <Link href="/portal/tools/jd-analyser" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Job Description Analyser</Link>
      <div className="mt-4" />
      <PageTitle title={jd.title} actions={<Button asChild size="sm"><Link href="/portal/tools/interview-coach">Practise for this role</Link></Button>}>
        {jd.company ? `${jd.company} · ` : ""}{formatDate(jd.created_at)} · seniority: {titleCase(j.seniority)}{j.yearsRequired != null ? ` · about ${j.yearsRequired}+ years requested` : ""}
      </PageTitle>
      {j.note ? <Alert tone="warning" className="mb-6">{j.note}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {j.ai ? <Card className="border-primary/40"><CardContent><p className="kicker mb-3">AI reading of the role</p><p className="leading-relaxed">{j.ai.summary}</p>{j.ai.hiddenExpectations.length ? <><p className="mt-4 text-sm font-medium">Implied expectations</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{j.ai.hiddenExpectations.map((h) => <li key={h}>{h}</li>)}</ul></> : null}{j.ai.questionsToAsk.length ? <><p className="mt-4 text-sm font-medium">Questions to ask the employer</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{j.ai.questionsToAsk.map((h) => <li key={h}>{h}</li>)}</ul></> : null}</CardContent></Card> : null}
          <Card><CardContent>
            <p className="kicker mb-4">Requirements extracted</p>
            <p className="text-sm font-medium">Required skills</p><div className="mt-2 flex flex-wrap gap-1.5" data-testid="required-skills">{j.requiredSkills.length ? j.requiredSkills.map((s) => <Badge key={s} variant="primary">{skillLabel(s)}</Badge>) : <span className="text-sm text-muted">No recognised security skills found in the required section.</span>}</div>
            <p className="mt-4 text-sm font-medium">Preferred skills</p><div className="mt-2 flex flex-wrap gap-1.5">{j.preferredSkills.length ? j.preferredSkills.map((s) => <Badge key={s}>{skillLabel(s)}</Badge>) : <span className="text-sm text-muted">None identified.</span>}</div>
            <p className="mt-4 text-sm font-medium">Certifications mentioned</p><div className="mt-2 flex flex-wrap gap-1.5">{j.certifications.length ? j.certifications.map((s) => <Badge key={s} variant="warning">{certLabel(s)}</Badge>) : <span className="text-sm text-muted">None mentioned.</span>}</div>
            <p className="mt-4 text-sm font-medium">Experience</p><p className="mt-1 text-sm text-muted">{j.yearsRequired != null ? `About ${j.yearsRequired}+ years requested.` : "No explicit number of years stated."} Seniority reads as {j.seniority}.</p>
          </CardContent></Card>
          {j.responsibilities.length ? <Card><CardContent><p className="kicker mb-3">Responsibilities</p><ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">{j.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></CardContent></Card> : null}
          {j.signals.length ? <Card><CardContent><p className="kicker mb-3">Worth noticing</p><ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">{j.signals.map((r) => <li key={r}>{r}</li>)}</ul></CardContent></Card> : null}
        </div>
        <div className="space-y-6">
          <Card><CardContent>
            <p className="kicker mb-4">Resume compatibility</p>
            {match ? (
              <div data-testid="jd-compat">
                <p className="text-3xl font-semibold">{match.coverage}<span className="text-base text-subtle">% of required skills appear in your latest resume</span></p>
                <Progress value={match.coverage} className="mt-3" label="Required skill overlap" />
                <p className="mt-4 text-sm font-medium">Covered</p><div className="mt-2 flex flex-wrap gap-1.5">{match.matched.length ? match.matched.map((s) => <Badge key={s} variant="success">{s}</Badge>) : <span className="text-sm text-muted">None.</span>}</div>
                <p className="mt-4 text-sm font-medium">Not in your resume</p><div className="mt-2 flex flex-wrap gap-1.5">{match.missing.length ? match.missing.map((s) => <Badge key={s} variant="danger">{s}</Badge>) : <span className="text-sm text-muted">None.</span>}</div>
                {match.missingCerts.length ? <p className="mt-4 text-sm text-muted">Certifications not found: {match.missingCerts.join(", ")}</p> : null}
                {match.experienceGap ? <p className="mt-4 text-sm text-muted">{match.experienceGap}</p> : null}
                <p className="mt-4 text-xs text-subtle">Compared with the resume uploaded on {formatDate(resume.created_at)}. Overlap describes wording, not your chances of being shortlisted.</p>
              </div>
            ) : <p className="text-sm text-muted">Upload a resume in the <Link href="/portal/tools/resume-analyzer" className="text-primary-hover underline">Resume Analyzer</Link> to see how it compares with this posting.</p>}
          </CardContent></Card>
          <Card><CardContent><p className="kicker mb-3">Interview preparation suggestions</p>{j.interviewPrep.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted">{j.interviewPrep.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-muted">Prepare the fundamentals: networking, authentication, a triage walkthrough and two STAR stories.</p>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}
