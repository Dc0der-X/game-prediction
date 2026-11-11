import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Alert, Badge, Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { SubmissionForm } from "@/components/portal/forms";

export const metadata = { title: "Assignment" };

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/assignments/${id}`);
  const data = await withUser(viewer, async (sql) => {
    const [a] = await sql`select a.*, c.title as course_title, c.slug as course_slug from assignments a join courses c on c.id = a.course_id where a.id = ${id}`;
    if (!a) return null;
    const [s] = await sql`select s.*, f.original_name as file_name from submissions s left join files f on f.id = s.file_id where s.assignment_id = ${id} and s.user_id = ${viewer.id}`;
    const feedback = s ? await sql`select fb.comments, fb.score, fb.outcome, fb.created_at, p.full_name as instructor from instructor_feedback fb left join profiles p on p.id = fb.instructor_id where fb.submission_id = ${s.id} order by fb.created_at desc` : [];
    return { a, s, feedback };
  });
  if (!data) notFound();
  const { a, s, feedback } = data;
  const locked = s?.status === "passed" || s?.status === "in_review";
  return (
    <>
      <Link href="/portal/assignments" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Assignments</Link>
      <div className="mt-4" />
      <PageTitle title={a.title}><span className="flex flex-wrap items-center gap-2"><Badge>{titleCase(a.kind)}</Badge><Link href={`/academy/courses/${a.course_slug}`} className="text-sm hover:text-primary-hover">{a.course_title}</Link>{s ? <Badge variant={s.status === "passed" ? "success" : s.status === "needs_changes" ? "warning" : "primary"} data-testid="submission-status">{titleCase(s.status)}</Badge> : null}</span></PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card><CardContent><p className="kicker mb-3">Instructions</p><Markdown>{a.instructions}</Markdown><p className="mt-4 font-mono text-xs text-subtle">Maximum score: {a.max_score}</p></CardContent></Card>
          <Card><CardContent>
            <p className="kicker mb-4">{s ? "Your submission" : "Submit your work"}</p>
            {s?.file_id ? <p className="mb-4 text-sm text-muted">Attached: <a href={`/api/files/${s.file_id}`} className="text-primary-hover hover:underline">{s.file_name}</a></p> : null}
            {locked ? <><Alert tone={s.status === "passed" ? "success" : "info"}>{s.status === "passed" ? "This work has been passed and is now locked." : "Your instructor is reviewing this submission."}</Alert><Markdown className="mt-5 text-sm">{s.content}</Markdown></>
              : <SubmissionForm assignmentId={a.id} content={s?.content} link={s?.link_url} resubmit={!!s} />}
          </CardContent></Card>
        </div>
        <Card className="self-start"><CardContent>
          <p className="kicker mb-4">Instructor feedback</p>
          {feedback.length ? (
            <ul className="space-y-5" data-testid="feedback-list">
              {feedback.map((f, i) => (
                <li key={i} className="border-l-2 border-primary pl-4">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={f.outcome === "passed" ? "success" : "warning"}>{titleCase(f.outcome)}</Badge>{f.score != null ? <span className="font-mono text-xs">{f.score}/{a.max_score}</span> : null}</div>
                  <Markdown className="mt-2 text-sm">{f.comments}</Markdown>
                  <p className="mt-2 font-mono text-xs text-subtle">{f.instructor ?? "Instructor"} · {formatDate(f.created_at, true)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">{s ? "No feedback yet. You will get a notification when your instructor has reviewed your work." : "Feedback appears here after you submit."}</p>}
        </CardContent></Card>
      </div>
    </>
  );
}
