import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Badge, EmptyState, Table } from "@/components/ui/card";

export const metadata = { title: "Assignments and projects" };
const TONE: Record<string, "default" | "primary" | "success" | "warning"> = { submitted: "primary", in_review: "primary", needs_changes: "warning", passed: "success" };

export default async function AssignmentsPage() {
  const viewer = await requireViewer("/portal/assignments");
  const rows = await withUser(viewer, (sql) => sql`
    select a.id, a.title, a.kind, c.title as course_title, s.status, s.submitted_at,
      (select f.score from instructor_feedback f where f.submission_id = s.id order by f.created_at desc limit 1) as score, a.max_score
    from assignments a join courses c on c.id = a.course_id left join submissions s on s.assignment_id = a.id and s.user_id = ${viewer.id}
    where a.status = 'published' order by c.position, a.position`);
  return (
    <>
      <PageTitle title="Assignments and projects">Submit your work for instructor review and read feedback.</PageTitle>
      {rows.length ? (
        <Table>
          <thead><tr><th>Assignment</th><th>Course</th><th>Type</th><th>Status</th><th>Score</th><th>Submitted</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/portal/assignments/${a.id}`} className="font-medium hover:text-primary-hover">{a.title}</Link></td>
                <td className="text-muted">{a.course_title}</td><td className="text-muted">{titleCase(a.kind)}</td>
                <td>{a.status ? <Badge variant={TONE[a.status]}>{titleCase(a.status)}</Badge> : <Badge>Not submitted</Badge>}</td>
                <td className="font-mono text-xs">{a.score != null ? `${a.score}/${a.max_score}` : "—"}</td><td className="text-muted">{formatDate(a.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <EmptyState title="No assignments yet">Assignments appear here when you are enrolled in a programme that includes them.</EmptyState>}
    </>
  );
}
