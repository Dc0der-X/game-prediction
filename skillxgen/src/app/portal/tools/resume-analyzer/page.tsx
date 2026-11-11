import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Card, CardContent, Table } from "@/components/ui/card";
import { ResumeUploadForm } from "@/components/portal/tool-forms";
import { AiStatusBanner, ToolDisclaimer } from "@/components/portal/ai-status";
import { ANALYSIS_DISCLAIMER } from "@/lib/career/resume";

export const metadata = { title: "Resume Analyzer" };

export default async function ResumeAnalyzerPage() {
  const viewer = await requireViewer("/portal/tools/resume-analyzer");
  const history = await withUser(viewer, (sql) => sql`select id, engine, created_at, result->>'fileName' as file_name, result->>'jobTitle' as job_title, (result->'analysis'->'scores'->>'overall')::int as overall from resume_analyses where user_id = ${viewer.id} order by created_at desc limit 20`);
  return (
    <>
      <PageTitle title="Resume Analyzer">Upload your resume for a structural review, skills extraction and — if you add a job description — a match against what the posting asks for.</PageTitle>
      <AiStatusBanner viewer={viewer} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card><CardContent><ResumeUploadForm /></CardContent></Card>
        <div>
          <p className="kicker mb-3">Previous analyses</p>
          {history.length ? (
            <Table><thead><tr><th>File</th><th>Compared with</th><th>Indicator</th><th>Date</th></tr></thead>
              <tbody>{history.map((h) => <tr key={h.id}><td><Link href={`/portal/tools/resume-analyzer/${h.id}`} className="font-medium hover:text-primary-hover">{h.file_name}</Link></td><td className="text-muted">{h.job_title ?? "—"}</td><td className="font-mono text-xs">{h.overall}/100</td><td className="text-muted">{formatDate(h.created_at)}</td></tr>)}</tbody>
            </Table>
          ) : <p className="text-sm text-muted">No analyses yet.</p>}
        </div>
      </div>
      <ToolDisclaimer>{ANALYSIS_DISCLAIMER}</ToolDisclaimer>
    </>
  );
}
