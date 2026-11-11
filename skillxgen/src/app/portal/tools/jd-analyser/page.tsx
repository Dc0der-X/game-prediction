import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "@/components/portal/tool-forms";
import { AiStatusBanner } from "@/components/portal/ai-status";

export const metadata = { title: "Job Description Analyser" };

export default async function JdAnalyserPage() {
  const viewer = await requireViewer("/portal/tools/jd-analyser");
  const history = await withUser(viewer, (sql) => sql`select id, title, company, created_at from job_descriptions where user_id = ${viewer.id} order by created_at desc limit 20`);
  return (
    <>
      <PageTitle title="Job Description Analyser">Paste a job posting to extract required skills, experience and certifications, see how your latest resume compares, and get interview preparation suggestions.</PageTitle>
      <AiStatusBanner viewer={viewer} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card><CardContent><JobForm /></CardContent></Card>
        <div>
          <p className="kicker mb-3">Saved job descriptions</p>
          {history.length ? <ul className="divide-y divide-border rounded-lg border border-border">{history.map((h) => <li key={h.id}><Link href={`/portal/tools/jd-analyser/${h.id}`} className="block px-4 py-3 text-sm hover:bg-elevated"><span className="font-medium">{h.title}</span>{h.company ? <span className="text-muted"> · {h.company}</span> : null}<span className="block font-mono text-xs text-subtle">{formatDate(h.created_at)}</span></Link></li>)}</ul> : <p className="text-sm text-muted">Nothing saved yet.</p>}
        </div>
      </div>
    </>
  );
}
