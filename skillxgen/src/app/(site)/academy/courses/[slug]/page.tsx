import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getCourseView } from "@/lib/learning";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Progress } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { Container, Section } from "@/components/site/sections";
import { EnrolFreeButton } from "@/components/site/course-controls";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await getCourseView(null, (await params).slug);
  return view ? { title: view.course.title, description: view.course.summary, alternates: { canonical: `/academy/courses/${view.course.slug}` } } : {};
}

export default async function CoursePage({ params }: Props) {
  const [{ slug }, viewer] = await Promise.all([params, getViewer().catch(() => null)]);
  const view = await getCourseView(viewer, slug);
  if (!view) notFound();
  const { course, modules, lessons, enrolment, access } = view;
  const pct = lessons.length ? (view.completed / lessons.length) * 100 : 0;
  return (
    <>
      <section className="grid-lines border-b border-border">
        <Container className="py-14 lg:py-20">
          <Link href={course.is_free ? "/academy" : "/courses"} className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← {course.is_free ? "Free academy" : "Courses"}</Link>
          <div className="mt-6 flex flex-wrap gap-2">{course.is_free ? <Badge variant="success">Free</Badge> : <Badge variant="primary">Included in {course.programme_title}</Badge>}<Badge>{course.level}</Badge><Badge>{lessons.length} lessons</Badge></div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">{course.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{course.summary}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {access && view.resumeSlug ? <Button asChild size="lg"><Link href={`/academy/courses/${slug}/${view.resumeSlug}`} data-testid="resume-course">{view.completed ? "Resume where you stopped" : "Start learning"}</Link></Button> : null}
            {!access && course.programme_slug ? <Button asChild size="lg"><Link href={`/programmes/${course.programme_slug}#enrol`}>Enrol in {course.programme_title}</Link></Button> : null}
            {course.is_free && !enrolment ? <EnrolFreeButton courseId={course.id} slug={slug} /> : null}
          </div>
          {enrolment ? (
            <div className="mt-8 max-w-md" data-testid="course-progress">
              <div className="mb-2 flex justify-between font-mono text-xs text-muted"><span>{enrolment.status === "completed" ? "Completed" : "Your progress"}</span><span>{view.completed} / {lessons.length}</span></div>
              <Progress value={pct} />
            </div>
          ) : course.is_free && !viewer ? <p className="mt-6 text-sm text-subtle">Reading is open to everyone. <Link href="/sign-up" className="underline">Create a free account</Link> to track progress.</p> : null}
        </Container>
      </section>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-2xl font-semibold">About this course</h2>
            <Markdown className="mt-4">{course.description}</Markdown>
            {course.instructor_name ? <p className="mt-6 text-sm text-muted">Instructor: {course.instructor_name}</p> : null}
            {!access ? <Alert className="mt-6">Lessons marked “Preview” are open to everyone. The rest unlock when you enrol in the programme.</Alert> : null}
          </div>
          <div className="space-y-8">
            {modules.map((m, mi) => (
              <div key={m.id}>
                <p className="kicker">Module {mi + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{m.title}</h3>
                <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                  {lessons.filter((l) => l.module_id === m.id).map((l) => {
                    const open = access || l.is_preview;
                    const Icon = l.status === "completed" ? CheckCircle2 : open ? Circle : Lock;
                    const row = (
                      <span className="flex items-center gap-3 px-4 py-3.5">
                        <Icon className={l.status === "completed" ? "size-4 text-success" : "size-4 text-subtle"} aria-hidden />
                        <span className="flex-1 text-sm">{l.title}</span>
                        {l.is_preview && !access ? <Badge>Preview</Badge> : null}
                        <span className="font-mono text-xs text-subtle">{l.duration_minutes} min</span>
                      </span>
                    );
                    return <li key={l.id}>{open ? <Link href={`/academy/courses/${slug}/${l.slug}`} className="block transition-colors hover:bg-elevated">{row}</Link> : <span className="block opacity-60">{row}</span>}</li>;
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
