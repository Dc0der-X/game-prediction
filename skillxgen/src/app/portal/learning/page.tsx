import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, EmptyState, Progress } from "@/components/ui/card";

export const metadata = { title: "My learning" };

export default async function LearningPage() {
  const viewer = await requireViewer("/portal/learning");
  const { mine, free } = await withUser(viewer, async (sql) => ({
    mine: await sql`
      select c.id, c.slug, c.title, c.summary, c.category, c.is_free, pg.title as programme_title,
        (select count(*)::int from lesson_outline l where l.course_id = c.id) as total,
        (select count(*)::int from progress pr where pr.course_id = c.id and pr.user_id = ${viewer.id} and pr.status = 'completed') as done,
        (select l.slug from progress pr join lesson_outline l on l.id = pr.lesson_id where pr.course_id = c.id and pr.user_id = ${viewer.id} order by pr.last_viewed_at desc limit 1) as last_slug
      from courses c left join programmes pg on pg.id = c.programme_id
      where c.status = 'published' and exists (select 1 from enrolments e where e.user_id = ${viewer.id} and e.status in ('active', 'completed') and (e.course_id = c.id or e.programme_id = c.programme_id))
      order by c.position`,
    free: await sql`select c.slug, c.title, c.summary from courses c where c.is_free and c.status = 'published'
      and not exists (select 1 from enrolments e where e.user_id = ${viewer.id} and e.course_id = c.id) order by c.position`,
  }));
  const core = mine.filter((c) => c.category !== "certification"), certs = mine.filter((c) => c.category === "certification");
  const card = (c: (typeof mine)[number]) => (
    <Card key={c.id}><CardContent className="flex h-full flex-col">
      <div className="flex flex-wrap gap-2">{c.is_free ? <Badge variant="success">Free</Badge> : <Badge variant="primary">{c.programme_title}</Badge>}{c.total > 0 && c.done >= c.total ? <Badge variant="success">Completed</Badge> : null}</div>
      <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{c.summary}</p>
      <div className="mt-4"><Progress value={c.total ? (c.done / c.total) * 100 : 0} /><p className="mt-1.5 font-mono text-xs text-subtle">{c.done} / {c.total} lessons</p></div>
      <Button asChild size="sm" className="mt-4 self-start"><Link href={c.last_slug ? `/academy/courses/${c.slug}/${c.last_slug}` : `/academy/courses/${c.slug}`}>{c.done ? "Resume" : "Start"}</Link></Button>
    </CardContent></Card>
  );
  return (
    <>
      <PageTitle title="My learning">Your enrolled courses, recorded lessons and downloadable resources.</PageTitle>
      {core.length ? <div className="grid gap-5 md:grid-cols-2">{core.map(card)}</div> : <EmptyState title="No courses yet">Enrol in a free course below, or <Link href="/courses" className="text-primary-hover underline">browse programmes</Link>.</EmptyState>}
      <h2 className="kicker mb-4 mt-12">Certification preparation</h2>
      {certs.length ? <div className="grid gap-5 md:grid-cols-2">{certs.map(card)}</div> : <p className="text-sm text-muted">Certification preparation courses are included with the SOC Analyst and Career Transition programmes. The Career Advisor recommends which certification to target first.</p>}
      {free.length ? (
        <>
          <h2 className="kicker mb-4 mt-12">Free courses you can start</h2>
          <div className="grid gap-5 md:grid-cols-2">{free.map((c) => <Card key={c.slug}><CardContent><Badge variant="success">Free</Badge><h3 className="mt-3 font-semibold">{c.title}</h3><p className="mt-1 text-sm text-muted">{c.summary}</p><Button asChild size="sm" variant="outline" className="mt-4"><Link href={`/academy/courses/${c.slug}`}>View course</Link></Button></CardContent></Card>)}</div>
        </>
      ) : null}
    </>
  );
}
