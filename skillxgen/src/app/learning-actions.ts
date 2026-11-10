"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { fail, ok, type ActionState } from "@/lib/forms";
import { completeLesson } from "@/lib/learning";
import { audit } from "@/lib/audit";
import { rateLimitByIp } from "@/lib/security";
import { LAB_BY_SLUG, gradeLab, type LabResult } from "@/content/labs";

export async function enrolFree(_: ActionState, fd: FormData): Promise<ActionState> {
  const courseId = fd.get("course_id"), slug = String(fd.get("slug") ?? "");
  if (!isUuid(courseId) || !/^[a-z0-9-]+$/.test(slug)) return fail("Invalid request.");
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/academy/courses/${slug}`)}`);
  try {
    // RLS only permits self-enrolment into published free courses.
    await withUser(viewer, (sql) => sql`insert into enrolments (user_id, course_id, source) values (${viewer.id}, ${courseId}, 'free') on conflict do nothing`);
  } catch {
    return fail("This course is not open for free enrolment.");
  }
  await audit(viewer, "enrolment.created", "course", courseId, { source: "free" });
  revalidatePath(`/academy/courses/${slug}`);
  return ok("You are enrolled. Your progress will be saved.");
}

export async function markLessonComplete(_: ActionState, fd: FormData): Promise<ActionState> {
  const lessonId = fd.get("lesson_id");
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in to save progress.");
  if (!isUuid(lessonId)) return fail("Invalid request.");
  const result = await completeLesson(viewer, lessonId).catch(() => null);
  if (!result) return fail("You do not have access to this lesson.");
  revalidatePath("/portal", "layout");
  const next = String(fd.get("next") ?? "");
  if (next.startsWith("/academy/courses/")) redirect(next);
  return ok(result.courseCompleted ? "Lesson complete — and that finishes the course." : "Lesson marked complete.");
}

export async function submitLab(slug: string, answers: Record<string, string>): Promise<{ ok: boolean; message?: string; result?: LabResult; saved?: boolean }> {
  const lab = LAB_BY_SLUG.get(slug);
  if (!lab) return { ok: false, message: "Lab not found." };
  if (!(await rateLimitByIp("lab:submit", 60, 3600)).ok) return { ok: false, message: "Too many submissions. Try again later." };
  const clean: Record<string, string> = {};
  for (const q of lab.questions) clean[q.id] = String(answers?.[q.id] ?? "").slice(0, 200);
  const result = gradeLab(lab, clean);
  const viewer = await getViewer().catch(() => null);
  if (viewer) {
    await withUser(viewer, (sql) => sql`insert into lab_attempts (user_id, lab_slug, answers, score, max_score) values (${viewer.id}, ${slug}, ${sql.json(clean)}, ${result.score}, ${result.max})
      on conflict (user_id, lab_slug) do update set answers = excluded.answers, score = greatest(lab_attempts.score, excluded.score), max_score = excluded.max_score, completed_at = now()`);
  }
  return { ok: true, result, saved: !!viewer };
}
