import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { ROLES } from "@/lib/career/taxonomy";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Badge, Card, CardContent, Table } from "@/components/ui/card";
import { InterviewStartForm } from "@/components/portal/tool-forms";
import { AiStatusBanner, ToolDisclaimer } from "@/components/portal/ai-status";

export const metadata = { title: "Interview Coach" };

export default async function InterviewCoachPage() {
  const viewer = await requireViewer("/portal/tools/interview-coach");
  const d = await withUser(viewer, async (sql) => ({
    resumes: await sql`select r.id, coalesce(f.original_name, 'Resume') || ' · ' || to_char(r.created_at, 'DD Mon') as label from resumes r left join files f on f.id = r.file_id where r.user_id = ${viewer.id} order by r.created_at desc limit 8`,
    jobs: await sql`select id, title || ' · ' || to_char(created_at, 'DD Mon') as label from job_descriptions where user_id = ${viewer.id} order by created_at desc limit 8`,
    sessions: await sql`select s.id, s.target_role, s.mode, s.status, s.created_at, (s.summary->>'average')::int as average,
      (select count(*)::int from interview_questions q where q.session_id = s.id) as total, (select count(*)::int from interview_questions q where q.session_id = s.id and q.answered_at is not null) as answered
      from interview_sessions s where s.user_id = ${viewer.id} order by s.created_at desc limit 20`,
  }));
  return (
    <>
      <PageTitle title="Interview Coach">Practise role-specific technical and behavioural questions. Add your resume and a job description and the questions are built around them. You get feedback on every answer.</PageTitle>
      <AiStatusBanner viewer={viewer} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card><CardContent><InterviewStartForm roles={ROLES.map((r) => ({ id: r.id, label: r.title }))} resumes={d.resumes as never} jobs={d.jobs as never} /></CardContent></Card>
        <div>
          <p className="kicker mb-3">Interview history</p>
          {d.sessions.length ? (
            <Table data-testid="interview-history"><thead><tr><th>Session</th><th>Progress</th><th>Avg.</th><th>Date</th></tr></thead>
              <tbody>{d.sessions.map((s) => <tr key={s.id}><td><Link href={`/portal/tools/interview-coach/${s.id}`} className="font-medium hover:text-primary-hover">{ROLES.find((r) => r.id === s.target_role)?.title ?? s.target_role}</Link><span className="block text-xs text-subtle">{titleCase(s.mode)}</span></td><td><Badge variant={s.status === "completed" ? "success" : "primary"}>{s.status === "completed" ? "Completed" : `${s.answered}/${s.total}`}</Badge></td><td className="font-mono text-xs">{s.average ?? "—"}</td><td className="text-muted">{formatDate(s.created_at)}</td></tr>)}</tbody>
            </Table>
          ) : <p className="text-sm text-muted">No practice sessions yet.</p>}
        </div>
      </div>
      <ToolDisclaimer>Practice scores reflect coverage of expected points and answer structure. They are a training aid and do not predict the outcome of any real interview.</ToolDisclaimer>
    </>
  );
}
