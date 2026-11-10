import { service, withUser, type Identity } from "./db";

export type OutlineLesson = { id: string; module_id: string; slug: string; title: string; duration_minutes: number; is_preview: boolean; position: number; status: string | null };

export async function getCourseView(viewer: Identity, slug: string) {
  return withUser(viewer, async (sql) => {
    const [course] = await sql`select c.*, p.slug as programme_slug, p.title as programme_title, i.full_name as instructor_name
      from courses c left join programmes p on p.id = c.programme_id left join profiles i on i.id = c.instructor_id where c.slug = ${slug} and c.status = 'published'`;
    if (!course) return null;
    const modules = await sql`select id, title, summary, position from modules where course_id = ${course.id} order by position`;
    const lessons = await sql<OutlineLesson[]>`
      select l.id, l.module_id, l.slug, l.title, l.duration_minutes, l.is_preview, l.position,
        (select pr.status from progress pr where pr.lesson_id = l.id and pr.user_id = app.user_id()) as status
      from lesson_outline l where l.course_id = ${course.id} order by l.position`;
    const [enrolment] = viewer ? await sql`select id, status, course_id, programme_id from enrolments where user_id = ${viewer.id} and status in ('active', 'completed')
      and (course_id = ${course.id} or (programme_id is not null and programme_id = ${course.programme_id})) limit 1` : [];
    const [{ access }] = await sql`select app.can_access_course(${course.id}) as access`;
    const [resume] = viewer ? await sql`select l.slug from progress pr join lesson_outline l on l.id = pr.lesson_id where pr.user_id = ${viewer.id} and pr.course_id = ${course.id} order by pr.last_viewed_at desc limit 1` : [];
    const ordered = modules.flatMap((m) => lessons.filter((l) => l.module_id === m.id));
    const nextUp = ordered.find((l) => l.status !== "completed") ?? ordered[0];
    return { course, modules, lessons: ordered, enrolment: enrolment ?? null, access: access as boolean, resumeSlug: (resume?.slug as string | undefined) ?? nextUp?.slug ?? null,
      completed: ordered.filter((l) => l.status === "completed").length };
  });
}

/** Marks a lesson complete for the viewer and closes the enrolment when every lesson is done. */
export async function completeLesson(viewer: { id: string }, lessonId: string): Promise<{ courseCompleted: boolean } | null> {
  const row = await withUser(viewer, async (sql) => {
    const [lesson] = await sql`select id, course_id from lessons where id = ${lessonId}`; // RLS: only readable lessons
    if (!lesson) return null;
    await sql`insert into progress (user_id, lesson_id, course_id, status, completed_at) values (${viewer.id}, ${lesson.id}, ${lesson.course_id}, 'completed', now())
      on conflict (user_id, lesson_id) do update set status = 'completed', completed_at = coalesce(progress.completed_at, now()), last_viewed_at = now()`;
    const [counts] = await sql`select (select count(*)::int from lesson_outline where course_id = ${lesson.course_id}) as total,
      (select count(*)::int from progress where course_id = ${lesson.course_id} and user_id = ${viewer.id} and status = 'completed') as done`;
    return { courseId: lesson.course_id as string, all: counts.done >= counts.total };
  });
  if (!row) return null;
  if (row.all) {
    const sql = service();
    const updated = await sql`update enrolments set status = 'completed', completed_at = now() where user_id = ${viewer.id} and course_id = ${row.courseId} and status = 'active' returning id`;
    if (updated.length) {
      const [c] = await sql`select title from courses where id = ${row.courseId}`;
      await sql`insert into notifications (user_id, title, body, link) values (${viewer.id}, 'Course completed', ${`You completed “${c.title}”. Well done.`}, '/portal/learning')`;
    }
  }
  return { courseCompleted: row.all };
}
