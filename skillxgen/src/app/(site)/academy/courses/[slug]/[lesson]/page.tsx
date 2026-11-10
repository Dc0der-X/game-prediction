import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getCourseView } from "@/lib/learning";
import { safeHttpUrl } from "@/lib/security";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/card";
import { Container } from "@/components/site/sections";
import { CompleteLessonButton, EnrolFreeButton } from "@/components/site/course-controls";

type Props = { params: Promise<{ slug: string; lesson: string }> };
export const metadata: Metadata = { robots: { index: true } };

const EMBED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)[\w-]+/;

export default async function LessonPage({ params }: Props) {
  const [{ slug, lesson: lessonSlug }, viewer] = await Promise.all([params, getViewer().catch(() => null)]);
  const view = await getCourseView(viewer, slug);
  if (!view) notFound();
  const outline = view.lessons.find((l) => l.slug === lessonSlug);
  if (!outline) notFound();
  // RLS returns the lesson body only for previews, free courses, enrolled learners and the teaching team.
  const lesson = await withUser(viewer, async (sql) => {
    const [row] = await sql`select id, title, content, video_url, resources, duration_minutes from lessons where id = ${outline.id}`;
    if (row && viewer && view.enrolment) {
      await sql`insert into progress (user_id, lesson_id, course_id) values (${viewer.id}, ${row.id}, ${view.course.id})
        on conflict (user_id, lesson_id) do update set last_viewed_at = now()`;
    }
    return row;
  });
  if (!lesson) redirect(view.course.programme_slug ? `/programmes/${view.course.programme_slug}#enrol` : `/academy/courses/${slug}`);

  const idx = view.lessons.findIndex((l) => l.id === outline.id);
  const prev = view.lessons[idx - 1], next = view.lessons[idx + 1];
  const nextOpen = next && (view.access || next.is_preview) ? `/academy/courses/${slug}/${next.slug}` : undefined;
  const video = lesson.video_url && EMBED.test(lesson.video_url) ? lesson.video_url : null;
  const resources = ((lesson.resources ?? []) as { title: string; url: string }[]).filter((r) => r.url.startsWith("/") || safeHttpUrl(r.url));

  return (
    <Container className="grid gap-10 py-10 lg:grid-cols-[18rem_1fr] lg:py-14">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Link href={`/academy/courses/${slug}`} className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← {view.course.title}</Link>
        {view.enrolment ? <div className="mt-4"><Progress value={(view.completed / view.lessons.length) * 100} /><p className="mt-1.5 font-mono text-xs text-subtle">{view.completed} / {view.lessons.length} complete</p></div> : null}
        <nav aria-label="Lessons" className="mt-5 space-y-5">
          {view.modules.map((m) => (
            <div key={m.id}>
              <p className="kicker mb-2">{m.title}</p>
              <ul className="space-y-0.5">
                {view.lessons.filter((l) => l.module_id === m.id).map((l) => {
                  const open = view.access || l.is_preview;
                  const Icon = l.status === "completed" ? CheckCircle2 : Circle;
                  const cls = cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-sm", l.id === outline.id ? "bg-elevated text-foreground" : "text-muted", open && "hover:text-foreground");
                  const inner = <><Icon className={cn("mt-0.5 size-3.5 shrink-0", l.status === "completed" ? "text-success" : "text-subtle")} aria-hidden /><span>{l.title}</span></>;
                  return <li key={l.id}>{open ? <Link href={`/academy/courses/${slug}/${l.slug}`} className={cls} aria-current={l.id === outline.id ? "page" : undefined}>{inner}</Link> : <span className={cn(cls, "opacity-50")}>{inner}</span>}</li>;
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 max-w-3xl">
        <p className="font-mono text-xs text-subtle">Lesson {idx + 1} of {view.lessons.length} · {lesson.duration_minutes} min</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{lesson.title}</h1>
        {video ? <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-border"><iframe src={video} title={`${lesson.title} — recorded lesson`} className="size-full" allow="fullscreen; picture-in-picture" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div> : null}
        <Markdown className="mt-8">{lesson.content}</Markdown>
        {resources.length ? (
          <div className="mt-10 rounded-lg border border-border p-5">
            <p className="kicker mb-3">Downloadable resources</p>
            <ul className="space-y-2 text-sm">{resources.map((r) => <li key={r.url}><a href={r.url} className="text-primary-hover hover:underline">{r.title}</a></li>)}</ul>
          </div>
        ) : null}
        <div className="mt-10 flex flex-wrap items-start justify-between gap-4 border-t border-border pt-6">
          {prev && (view.access || prev.is_preview) ? <Button asChild variant="ghost"><Link href={`/academy/courses/${slug}/${prev.slug}`}>← Previous</Link></Button> : <span />}
          {viewer && view.enrolment ? <CompleteLessonButton lessonId={lesson.id} next={nextOpen} done={outline.status === "completed"} />
            : view.course.is_free && viewer ? <EnrolFreeButton courseId={view.course.id} slug={slug} />
            : nextOpen ? <Button asChild><Link href={nextOpen}>Next lesson →</Link></Button> : null}
        </div>
        {!viewer && view.course.is_free ? <Alert className="mt-6">Want to track what you have finished? <Link href={`/sign-up`} className="underline">Create a free account</Link> — it takes a minute.</Alert> : null}
      </article>
    </Container>
  );
}
