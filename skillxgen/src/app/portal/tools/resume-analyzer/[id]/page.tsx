import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { formatDate, titleCase } from "@/lib/utils";
import type { ResumeAnalysis } from "@/lib/career/resume";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardContent, Progress } from "@/components/ui/card";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Resume analysis" };
type Stored = { analysis: ResumeAnalysis; ai: { summary: string; priorities: string[]; rewrites: { before: string; after: string; why: string }[] } | null; note: string | null; fileName: string; jobTitle: string | null };

export default async function ResumeAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const viewer = await requireViewer(`/portal/tools/resume-analyzer/${id}`);
  const [row] = await withUser(viewer, (sql) => sql`select a.result, a.engine, a.model, a.created_at, r.file_id from resume_analyses a join resumes r on r.id = a.resume_id where a.id = ${id}`);
  if (!row) notFound();
  const { analysis: a, ai, note, fileName, jobTitle } = row.result as Stored;
  const tone = { pass: "success", warn: "warning", fail: "danger" } as const;
  return (
    <div data-testid="resume-analysis">
      <Link href="/portal/tools/resume-analyzer" className="no-print font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Resume Analyzer</Link>
      <div className="mt-4" />
      <PageTitle title="Resume analysis report" actions={<><PrintButton label="Print / PDF" /><Button asChild variant="outline" size="sm" className="no-print"><a href={`/portal/tools/resume-analyzer/${id}/export`} data-testid="export-report"><Download aria-hidden />Export (.md)</a></Button></>}>
        {fileName} · {formatDate(row.created_at, true)}{jobTitle ? ` · compared with “${jobTitle}”` : ""} · engine: {row.engine}{row.model ? ` (${row.model})` : ""}
      </PageTitle>
      <Alert className="mb-6">{a.disclaimer}</Alert>
      {note ? <Alert tone="warning" className="mb-6">{note}</Alert> : null}
      <div className="print-surface space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Structure and parseability", a.scores.structure], ["Content and evidence", a.scores.content], ["Skills coverage", a.scores.skills], ...(a.scores.jobMatch != null ? [["Overlap with job description", a.scores.jobMatch] as const] : [])].map(([label, v]) => (
            <Card key={label as string}><CardContent><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{v}<span className="text-base text-subtle">/100</span></p><Progress value={v as number} className="mt-3" label={label as string} /></CardContent></Card>
          ))}
        </div>
        {ai ? (
          <Card className="border-primary/40"><CardContent>
            <p className="kicker mb-3">AI review</p>
            <p className="leading-relaxed">{ai.summary}</p>
            {ai.priorities.length ? <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-muted">{ai.priorities.map((p) => <li key={p}>{p}</li>)}</ol> : null}
            {ai.rewrites.length ? <div className="mt-5 space-y-4">{ai.rewrites.map((r, i) => <div key={i} className="rounded-md border border-border p-4 text-sm"><p className="text-muted"><span className="font-mono text-xs text-subtle">BEFORE </span>{r.before}</p><p className="mt-2"><span className="font-mono text-xs text-success">AFTER </span>{r.after}</p><p className="mt-2 text-xs text-subtle">{r.why}</p></div>)}</div> : null}
          </CardContent></Card>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardContent>
            <p className="kicker mb-4">Checks</p>
            <ul className="space-y-4">{a.checks.map((c) => <li key={c.id} className="flex gap-3"><Badge variant={tone[c.status]} className="mt-0.5 h-fit w-12 justify-center">{c.status}</Badge><div><p className="text-sm font-medium">{c.label}</p><p className="text-sm text-muted">{c.detail}</p></div></li>)}</ul>
          </CardContent></Card>
          <div className="space-y-6">
            {a.jobMatch ? (
              <Card><CardContent data-testid="job-match">
                <p className="kicker mb-4">Job description match</p>
                <p className="text-sm text-muted">Matched required skills</p><div className="mt-2 flex flex-wrap gap-1.5">{a.jobMatch.matched.length ? a.jobMatch.matched.map((s) => <Badge key={s} variant="success">{s}</Badge>) : <span className="text-sm text-subtle">None</span>}</div>
                <p className="mt-4 text-sm text-muted">Missing required skills</p><div className="mt-2 flex flex-wrap gap-1.5">{a.jobMatch.missing.length ? a.jobMatch.missing.map((s) => <Badge key={s} variant="danger">{s}</Badge>) : <span className="text-sm text-subtle">None</span>}</div>
                {a.jobMatch.preferredMissing.length ? <><p className="mt-4 text-sm text-muted">Missing preferred skills</p><div className="mt-2 flex flex-wrap gap-1.5">{a.jobMatch.preferredMissing.map((s) => <Badge key={s} variant="warning">{s}</Badge>)}</div></> : null}
                {a.jobMatch.missingCerts.length ? <p className="mt-4 text-sm text-muted">Certifications named in the posting but not found: {a.jobMatch.missingCerts.join(", ")}</p> : null}
              </CardContent></Card>
            ) : null}
            <Card><CardContent>
              <p className="kicker mb-4">Skills and experience extracted</p>
              <p className="text-sm text-muted">About {a.experienceYears} years of dated experience detected.</p>
              <dl className="mt-3 space-y-3">{Object.entries(a.skillsByCategory).map(([cat, skills]) => <div key={cat}><dt className="font-mono text-xs uppercase tracking-wider text-subtle">{titleCase(cat)}</dt><dd className="mt-1 flex flex-wrap gap-1.5">{skills.map((s) => <Badge key={s}>{s}</Badge>)}</dd></div>)}</dl>
              {a.certifications.length ? <p className="mt-4 text-sm text-muted">Certifications: {a.certifications.join(", ")}</p> : null}
            </CardContent></Card>
          </div>
        </div>
        <Card><CardContent><p className="kicker mb-4">Recommended improvements</p><ul className="list-disc space-y-2 pl-5 text-sm text-muted">{a.improvements.map((i) => <li key={i}>{i}</li>)}</ul></CardContent></Card>
      </div>
      {row.file_id ? <p className="no-print mt-6 text-sm text-muted"><a href={`/api/files/${row.file_id}`} className="text-primary-hover hover:underline">Download the uploaded file</a></p> : null}
    </div>
  );
}
