import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { ROLES } from "@/lib/career/taxonomy";
import type { AnswerFeedback, KeyPoint } from "@/lib/career/interview";
import { titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Alert, Badge, Card, CardContent, Progress } from "@/components/ui/card";
import { AnswerForm, FinishInterview } from "@/components/portal/tool-forms";

export const metadata = { title: "Practice interview" };

export default async function InterviewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/tools/interview-coach/${id}`);
  const data = await withUser(viewer, async (sql) => {
    const [s] = await sql`select * from interview_sessions where id = ${id}`;
    return s ? { s, qs: await sql`select * from interview_questions where session_id = ${id} order by position` } : null;
  });
  if (!data) notFound();
  const { s, qs } = data;
  const answered = qs.filter((q) => q.answered_at).length;
  const done = s.status === "completed";
  const summary = s.summary as { answered: number; total: number; average: number | null; technical: number | null; behavioural: number | null; focusAreas: string[]; note: string } | null;
  return (
    <div data-testid="interview-session">
      <Link href="/portal/tools/interview-coach" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Interview Coach</Link>
      <div className="mt-4" />
      <PageTitle title={`${ROLES.find((r) => r.id === s.target_role)?.title ?? s.target_role} — ${titleCase(s.mode)} interview`} actions={!done && answered > 0 ? <FinishInterview sessionId={id} /> : null}>
        {answered} of {qs.length} questions answered · engine: {s.engine}
      </PageTitle>
      <Progress value={(answered / qs.length) * 100} className="mb-8 max-w-md" label="Questions answered" />
      {done && summary ? (
        <Card className="mb-8 border-success/40"><CardContent data-testid="interview-summary">
          <p className="kicker text-success">Session summary</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            {[["Overall", summary.average], ["Technical", summary.technical], ["Behavioural", summary.behavioural]].map(([l, v]) => <div key={l as string}><p className="text-sm text-muted">{l}</p><p className="text-3xl font-semibold">{v ?? "—"}{v != null ? <span className="text-base text-subtle">/100</span> : null}</p></div>)}
          </div>
          {summary.focusAreas.length ? <><p className="mt-5 text-sm font-medium">Recurring improvement areas</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{summary.focusAreas.map((f) => <li key={f}>{f}</li>)}</ul></> : null}
          <p className="mt-4 text-xs text-subtle">{summary.note}</p>
        </CardContent></Card>
      ) : null}
      <ol className="space-y-6">
        {qs.map((q, i) => {
          const fb = q.feedback as AnswerFeedback | null;
          const g = q.guidance as { structure?: string[]; keyPoints?: KeyPoint[]; anchor?: string };
          return (
            <li key={q.id}><Card><CardContent data-testid={`question-${i}`}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-primary-hover">Q{i + 1}</span><Badge>{titleCase(q.category)}</Badge>{q.score != null ? <Badge variant={q.score >= 70 ? "success" : q.score >= 45 ? "warning" : "danger"} data-testid="question-score">{q.score}/100</Badge> : null}</div>
              <p className="mt-3 text-lg font-medium leading-snug">{q.question}</p>
              {g.anchor ? <p className="mt-2 text-sm text-primary-hover">{g.anchor}</p> : null}
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted hover:text-foreground">Suggested answer structure</summary><ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">{(g.structure ?? []).map((x) => <li key={x}>{x}</li>)}</ol></details>
              {fb ? (
                <div className="mt-5 space-y-4 border-t border-border pt-5" data-testid="answer-feedback">
                  <div><p className="font-mono text-xs uppercase tracking-wider text-subtle">Your answer</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted">{q.answer}</p></div>
                  {fb.ai ? <Alert><strong>Coach: </strong>{fb.ai.feedback}{fb.ai.improvedOutline.length ? <ul className="mt-2 list-disc pl-5">{fb.ai.improvedOutline.map((x) => <li key={x}>{x}</li>)}</ul> : null}</Alert> : null}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><p className="text-sm font-medium text-success">What worked</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{fb.strengths.length ? fb.strengths.map((x) => <li key={x}>{x}</li>) : <li>Nothing specific yet — see the improvements.</li>}</ul></div>
                    <div><p className="text-sm font-medium text-warning">Improve</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{fb.improvements.length ? fb.improvements.map((x) => <li key={x}>{x}</li>) : <li>Strong answer. Practise delivering it aloud in under two minutes.</li>}</ul></div>
                  </div>
                  {fb.followUp ? <p className="rounded-md border border-border p-3 text-sm"><span className="font-mono text-xs text-primary-hover">FOLLOW-UP </span>{fb.followUp}</p> : null}
                </div>
              ) : null}
              {!done ? <div className="mt-5"><AnswerForm questionId={q.id} existing={q.answer} /></div> : null}
            </CardContent></Card></li>
          );
        })}
      </ol>
    </div>
  );
}
