import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, EmptyState, Progress } from "@/components/ui/card";

export default async function PortalDashboard() {
  const viewer = await requireViewer("/portal");
  const d = await withUser(viewer, async (sql) => {
    const courses = await sql`
      select c.id, c.slug, c.title, c.is_free, pg.title as programme_title,
        (select count(*)::int from lesson_outline l where l.course_id = c.id) as total,
        (select count(*)::int from progress pr where pr.course_id = c.id and pr.user_id = ${viewer.id} and pr.status = 'completed') as done,
        (select l.slug from progress pr join lesson_outline l on l.id = pr.lesson_id where pr.course_id = c.id and pr.user_id = ${viewer.id} order by pr.last_viewed_at desc limit 1) as last_slug,
        (select l.title from progress pr join lesson_outline l on l.id = pr.lesson_id where pr.course_id = c.id and pr.user_id = ${viewer.id} order by pr.last_viewed_at desc limit 1) as last_title,
        (select max(pr.last_viewed_at) from progress pr where pr.course_id = c.id and pr.user_id = ${viewer.id}) as last_at
      from courses c left join programmes pg on pg.id = c.programme_id
      where c.status = 'published' and exists (select 1 from enrolments e where e.user_id = ${viewer.id} and e.status in ('active', 'completed') and (e.course_id = c.id or e.programme_id = c.programme_id))
      order by last_at desc nulls last, c.position`;
    return {
      courses,
      programmes: await sql`select pg.title, pg.slug, e.status, e.started_at from enrolments e join programmes pg on pg.id = e.programme_id where e.user_id = ${viewer.id} and e.status in ('active', 'completed')`,
      notifications: await sql`select id, title, body, link, created_at from notifications where user_id = ${viewer.id} and read_at is null order by created_at desc limit 4`,
      pending: await sql`select a.id, a.title, a.kind, c.title as course_title, s.status from assignments a join courses c on c.id = a.course_id left join submissions s on s.assignment_id = a.id and s.user_id = ${viewer.id}
        where a.status = 'published' and (s.id is null or s.status = 'needs_changes') order by a.position limit 4`,
      labs: (await sql`select count(*)::int as n from lab_attempts where user_id = ${viewer.id}`)[0].n as number,
      resume: (await sql`select count(*)::int as n from resume_analyses where user_id = ${viewer.id}`)[0].n as number,
      interviews: (await sql`select count(*)::int as n from interview_sessions where user_id = ${viewer.id} and status = 'completed'`)[0].n as number,
      assessment: (await sql`select target_role, result from career_assessments where user_id = ${viewer.id} order by created_at desc limit 1`)[0],
      passed: (await sql`select count(*)::int as n from submissions where user_id = ${viewer.id} and status = 'passed'`)[0].n as number,
    };
  });
  const current = d.courses.find((c) => c.done < c.total) ?? d.courses[0];
  const lessonsDone = d.courses.reduce((n, c) => n + c.done, 0);
  const milestones: [string, boolean, string][] = [
    ["Start a course", d.courses.length > 0, "/academy"],
    ["Complete your first lesson", lessonsDone > 0, current ? `/academy/courses/${current.slug}` : "/academy"],
    ["Finish a SOC lab", d.labs > 0, "/academy/soc-labs"],
    ["Build your career roadmap", !!d.assessment, "/portal/tools/career-advisor"],
    ["Analyse your resume", d.resume > 0, "/portal/tools/resume-analyzer"],
    ["Complete a mock interview", d.interviews > 0, "/portal/tools/interview-coach"],
    ["Pass an assignment", d.passed > 0, "/portal/assignments"],
  ];
  return (
    <>
      <PageTitle title={`Welcome back${viewer.fullName ? `, ${viewer.fullName.split(" ")[0]}` : ""}`}>Pick up where you stopped, or work on your career tools.</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {current ? (
            <Card className="border-primary/40"><CardContent className="p-6" data-testid="continue-learning">
              <p className="kicker">Continue learning</p>
              <h2 className="mt-3 text-xl font-semibold">{current.title}</h2>
              <p className="mt-1 text-sm text-muted">{current.last_title ? `Last opened: ${current.last_title}` : "Not started yet"}</p>
              <div className="mt-4 max-w-sm"><Progress value={current.total ? (current.done / current.total) * 100 : 0} /><p className="mt-1.5 font-mono text-xs text-subtle">{current.done} of {current.total} lessons complete</p></div>
              <Button asChild className="mt-5"><Link href={current.last_slug ? `/academy/courses/${current.slug}/${current.last_slug}` : `/academy/courses/${current.slug}`} data-testid="resume-link">{current.last_slug ? "Resume lesson" : "Start course"}</Link></Button>
            </CardContent></Card>
          ) : (
            <EmptyState title="You are not enrolled in anything yet">Start with the free SOC Analyst Foundations course. <Link href="/academy/courses/soc-analyst-foundations" className="text-primary-hover underline">Open the free course</Link></EmptyState>
          )}
          {d.programmes.length ? (
            <Card><CardContent>
              <p className="kicker mb-3">Enrolled programmes</p>
              <ul className="divide-y divide-border">{d.programmes.map((p) => <li key={p.slug} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-medium">{p.title}</span><span className="flex items-center gap-3"><Badge variant={p.status === "completed" ? "success" : "primary"}>{p.status}</Badge><span className="font-mono text-xs text-subtle">since {formatDate(p.started_at)}</span></span></li>)}</ul>
            </CardContent></Card>
          ) : null}
          {d.courses.length > 1 ? (
            <Card><CardContent>
              <p className="kicker mb-3">Course progress</p>
              <ul className="space-y-4">{d.courses.map((c) => <li key={c.id}><div className="mb-1.5 flex justify-between gap-3 text-sm"><Link href={`/academy/courses/${c.slug}`} className="hover:text-primary-hover">{c.title}</Link><span className="font-mono text-xs text-subtle">{c.done}/{c.total}</span></div><Progress value={c.total ? (c.done / c.total) * 100 : 0} /></li>)}</ul>
            </CardContent></Card>
          ) : null}
          {d.pending.length ? (
            <Card><CardContent>
              <p className="kicker mb-3">Assignments to do</p>
              <ul className="divide-y divide-border">{d.pending.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><Link href={`/portal/assignments/${a.id}`} className="text-sm hover:text-primary-hover">{a.title}</Link>{a.status === "needs_changes" ? <Badge variant="warning">Changes requested</Badge> : <Badge>Not submitted</Badge>}</li>)}</ul>
            </CardContent></Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card><CardContent>
            <p className="kicker mb-4">Learning milestones</p>
            <ol className="space-y-3">
              {milestones.map(([label, done, href]) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className={`grid size-5 shrink-0 place-items-center rounded-sm border font-mono text-[0.65rem] ${done ? "border-success bg-success/15 text-success" : "border-border-strong text-subtle"}`}>{done ? "✓" : ""}</span>
                  {done ? <span className="text-muted line-through decoration-subtle">{label}</span> : <Link href={href} className="hover:text-primary-hover">{label}</Link>}
                </li>
              ))}
            </ol>
          </CardContent></Card>
          <Card><CardContent>
            <div className="mb-3 flex items-center justify-between"><p className="kicker">Notifications</p><Link href="/portal/notifications" className="text-xs text-muted hover:text-foreground">View all</Link></div>
            {d.notifications.length ? <ul className="space-y-3">{d.notifications.map((n) => <li key={n.id} className="text-sm"><Link href={n.link ?? "/portal/notifications"} className="font-medium hover:text-primary-hover">{n.title}</Link><p className="text-muted">{n.body}</p></li>)}</ul> : <p className="text-sm text-muted">You are all caught up.</p>}
          </CardContent></Card>
          {d.assessment ? (
            <Card><CardContent>
              <p className="kicker">Career roadmap</p>
              <p className="mt-3 font-medium">{d.assessment.result.role.title}</p>
              <p className="mt-1 text-sm text-muted">{d.assessment.result.readiness.band} · {d.assessment.result.gap.coreCoverage}% core skills</p>
              <Button asChild size="sm" variant="outline" className="mt-4"><Link href="/portal/roadmap">Open roadmap</Link></Button>
            </CardContent></Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
