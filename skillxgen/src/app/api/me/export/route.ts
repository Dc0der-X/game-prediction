import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

// Self-service data export (GDPR / CCPA / PIPEDA access request). Runs under RLS, so it can only ever return the caller's rows.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!(await rateLimit(`export:${viewer.id}`, 5, 3600)).ok) return new Response("Too many requests", { status: 429 });
  const data = await withUser(viewer, async (sql) => ({
    exported_at: new Date().toISOString(),
    profile: (await sql`select id, email, full_name, role, country, headline, bio, career_level, target_role, linkedin_url, marketing_consent, created_at from profiles where id = ${viewer.id}`)[0],
    enrolments: await sql`select programme_id, course_id, status, source, started_at, completed_at from enrolments where user_id = ${viewer.id}`,
    progress: await sql`select lesson_id, course_id, status, last_viewed_at, completed_at from progress where user_id = ${viewer.id}`,
    lab_attempts: await sql`select lab_slug, score, max_score, completed_at from lab_attempts where user_id = ${viewer.id}`,
    submissions: await sql`select assignment_id, content, link_url, status, submitted_at from submissions where user_id = ${viewer.id}`,
    resumes: await sql`select id, parsed_text, parsed, created_at from resumes where user_id = ${viewer.id}`,
    resume_analyses: await sql`select resume_id, engine, result, created_at from resume_analyses where user_id = ${viewer.id}`,
    job_descriptions: await sql`select title, company, raw_text, parsed, created_at from job_descriptions where user_id = ${viewer.id}`,
    career_assessments: await sql`select target_role, input, result, created_at from career_assessments where user_id = ${viewer.id}`,
    interview_sessions: await sql`select id, target_role, mode, status, summary, created_at from interview_sessions where user_id = ${viewer.id}`,
    interview_questions: await sql`select session_id, question, answer, feedback, score from interview_questions where user_id = ${viewer.id}`,
    learning_sessions: await sql`select topic, prompt, response, created_at from learning_sessions where user_id = ${viewer.id}`,
    payments: await sql`select programme_id, currency, amount, status, receipt_number, paid_at, created_at from payments where user_id = ${viewer.id}`,
    support_tickets: await sql`select id, subject, category, status, created_at from support_tickets where user_id = ${viewer.id}`,
    notifications: await sql`select title, body, created_at, read_at from notifications where user_id = ${viewer.id}`,
    files: await sql`select id, bucket, original_name, mime_type, size_bytes, created_at from files where owner_id = ${viewer.id}`,
  }));
  await audit(viewer, "data.exported", "profile", viewer.id);
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="skillxgen-my-data.json"', "Cache-Control": "private, no-store" } });
}
