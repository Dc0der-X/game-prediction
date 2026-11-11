import Link from "next/link";
import type { AdvisorResult } from "@/lib/career/advisor";
import { Alert, Badge, Card, CardContent, Progress } from "@/components/ui/card";

type Result = AdvisorResult & { ai?: { commentary: string; weeklyPlan: string[]; watchOuts: string[] } | null; note?: string | null };

export function RoadmapView({ result }: { result: Result }) {
  return (
    <div className="space-y-6" data-testid="roadmap">
      {result.note ? <Alert tone="warning">{result.note}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2"><CardContent>
          <p className="kicker">Target role</p>
          <h2 className="mt-2 text-2xl font-semibold">{result.role.title}</h2>
          <p className="mt-1 text-sm text-muted">{result.role.summary}</p>
        </CardContent></Card>
        <Card><CardContent>
          <p className="kicker">Job-readiness indicator</p>
          <p className="mt-2 text-3xl font-semibold" data-testid="readiness-score">{result.readiness.score}<span className="text-base text-subtle">/100</span></p>
          <Badge variant="primary" className="mt-2">{result.readiness.band}</Badge>
          <Progress value={result.readiness.score} className="mt-3" label="Job readiness" />
          <p className="mt-3 text-xs text-subtle">{result.readiness.explanation}</p>
        </CardContent></Card>
      </div>
      {result.ai ? (
        <Card className="border-primary/40"><CardContent>
          <p className="kicker mb-3">Adviser commentary (AI)</p>
          <p className="leading-relaxed">{result.ai.commentary}</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div><p className="text-sm font-medium">Weekly habits</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{result.ai.weeklyPlan.map((w) => <li key={w}>{w}</li>)}</ul></div>
            <div><p className="text-sm font-medium">Watch out for</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{result.ai.watchOuts.map((w) => <li key={w}>{w}</li>)}</ul></div>
          </div>
        </CardContent></Card>
      ) : null}
      <Card><CardContent>
        <p className="kicker mb-4">Skills-gap analysis · {result.gap.coreCoverage}% of core skills</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div><p className="text-sm font-medium">Core skills to build</p><div className="mt-2 flex flex-wrap gap-1.5">{result.gap.coreMissing.length ? result.gap.coreMissing.map((s) => <Badge key={s} variant="danger">{s}</Badge>) : <span className="text-sm text-muted">None — core covered.</span>}</div></div>
          <div><p className="text-sm font-medium">Core skills in place</p><div className="mt-2 flex flex-wrap gap-1.5">{result.gap.coreHave.length ? result.gap.coreHave.map((s) => <Badge key={s} variant="success">{s}</Badge>) : <span className="text-sm text-muted">None yet.</span>}</div></div>
          <div><p className="text-sm font-medium">Desirable skills to add</p><div className="mt-2 flex flex-wrap gap-1.5">{result.gap.desirableMissing.map((s) => <Badge key={s} variant="warning">{s}</Badge>)}</div></div>
          <div><p className="text-sm font-medium">Desirable skills in place</p><div className="mt-2 flex flex-wrap gap-1.5">{result.gap.desirableHave.length ? result.gap.desirableHave.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-sm text-muted">None yet.</span>}</div></div>
        </div>
      </CardContent></Card>
      <Card><CardContent>
        <p className="kicker mb-4">Personalised learning roadmap · about {result.totalWeeks} weeks at your pace</p>
        <ol className="space-y-5">
          {result.roadmap.map((p, i) => (
            <li key={p.title} className="grid gap-3 border-l-2 border-border pl-5 md:grid-cols-[14rem_1fr]">
              <div><p className="font-mono text-xs text-primary-hover">PHASE {i + 1} · {p.weeks} {p.weeks === 1 ? "week" : "weeks"}</p><p className="mt-1 font-semibold">{p.title}</p><Badge className="mt-2" variant={p.status === "review" ? "success" : "default"}>{p.status === "review" ? "Review only" : "Learn"}</Badge></div>
              <div><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{p.focus.map((f) => <li key={f}>{f}</li>)}</ul>{p.newSkills.length ? <p className="mt-2 text-xs text-subtle">New for you: {p.newSkills.join(", ")}</p> : null}</div>
            </li>
          ))}
        </ol>
      </CardContent></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardContent><p className="kicker mb-4">Project recommendations</p><ul className="space-y-4">{result.projects.map((p) => <li key={p.title}><p className="font-medium">{p.title}</p><p className="text-sm text-muted">{p.description}</p><p className="mt-1 text-xs text-subtle">Covers: {p.covers.join(", ")}</p></li>)}</ul></CardContent></Card>
        <Card><CardContent><p className="kicker mb-4">Certification recommendations</p>{result.certifications.length ? <ul className="space-y-4">{result.certifications.map((c) => <li key={c.label}><p className="font-medium">{c.label}</p><p className="text-sm text-muted">{c.why}</p></li>)}</ul> : <p className="text-sm text-muted">You already hold the certifications most relevant to this role.</p>}</CardContent></Card>
      </div>
      <Card><CardContent><p className="kicker mb-3">Next steps</p><ol className="list-decimal space-y-2 pl-5 text-sm text-muted">{result.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol><p className="mt-4 text-sm"><Link href={`/programmes/${result.role.programme}`} className="text-primary-hover hover:underline">Related programme →</Link></p></CardContent></Card>
      <p className="text-xs text-subtle">{result.disclaimer}</p>
    </div>
  );
}
