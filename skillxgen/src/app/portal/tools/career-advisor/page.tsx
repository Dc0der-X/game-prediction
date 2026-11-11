import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { CERTS, ROLES, SKILLS } from "@/lib/career/taxonomy";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdvisorForm } from "@/components/portal/tool-forms";
import { AiStatusBanner } from "@/components/portal/ai-status";
import { RoadmapView } from "@/components/portal/roadmap-view";

export const metadata = { title: "Career Advisor" };

export default async function CareerAdvisorPage({ searchParams }: { searchParams: Promise<{ id?: string; new?: string }> }) {
  const sp = await searchParams;
  const viewer = await requireViewer("/portal/tools/career-advisor");
  const { current, history } = await withUser(viewer, async (sql) => ({
    current: isUuid(sp.id) ? (await sql`select id, result, created_at, engine from career_assessments where id = ${sp.id} and user_id = ${viewer.id}`)[0] : undefined,
    history: await sql`select id, target_role, created_at, (result->'readiness'->>'score')::int as score from career_assessments where user_id = ${viewer.id} order by created_at desc limit 10`,
  }));
  const groups = [...new Set(SKILLS.map((s) => s.category))].map((category) => ({ category: titleCase(category), items: SKILLS.filter((s) => s.category === category).map((s) => ({ id: s.id, label: s.label })) }));
  return (
    <>
      <PageTitle title="Career Advisor" actions={current ? <Button asChild variant="outline" size="sm"><Link href="/portal/tools/career-advisor">New assessment</Link></Button> : null}>
        Assess your current skills against a target role and get a skills-gap analysis, a personal learning roadmap, project ideas and certification recommendations.
      </PageTitle>
      <AiStatusBanner viewer={viewer} />
      {current ? <><p className="mb-4 font-mono text-xs text-subtle">Assessment from {formatDate(current.created_at, true)} · engine: {current.engine}</p><RoadmapView result={current.result} /></> : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card><CardContent><AdvisorForm roles={ROLES.map((r) => ({ id: r.id, label: r.title }))} skills={groups} certs={CERTS.map((c) => ({ id: c.id, label: c.label }))} /></CardContent></Card>
          <div>
            <p className="kicker mb-3">Previous assessments</p>
            {history.length ? <ul className="divide-y divide-border rounded-lg border border-border">{history.map((h) => <li key={h.id}><Link href={`/portal/tools/career-advisor?id=${h.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-elevated"><span>{ROLES.find((r) => r.id === h.target_role)?.title ?? h.target_role}</span><span className="font-mono text-xs text-subtle">{h.score}/100 · {formatDate(h.created_at)}</span></Link></li>)}</ul> : <p className="text-sm text-muted">No assessments yet.</p>}
          </div>
        </div>
      )}
    </>
  );
}
