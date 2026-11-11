"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { fail, ok, optionalText, parseForm, text, type ActionState } from "@/lib/forms";
import { rateLimit } from "@/lib/security";
import { audit } from "@/lib/audit";
import { UploadError, validateUpload } from "@/lib/uploads";
import { storeFile } from "@/lib/storage";
import { SAFETY_PREAMBLE, tryEnrich } from "@/lib/ai/provider";
import { ResumeParseError, analyzeResume, extractText, parseResume, type ParsedResume } from "@/lib/career/resume";
import { parseJobDescription, type ParsedJob } from "@/lib/career/jd";
import { assessCareer } from "@/lib/career/advisor";
import { CERTS, ROLE_BY_ID, SKILL_BY_ID } from "@/lib/career/taxonomy";
import { evaluateAnswer, generateQuestions, summariseSession, type AnswerFeedback } from "@/lib/career/interview";
import { TOPICS, answerFromKnowledge, searchKnowledge, type Topic } from "@/lib/career/assistant";

const LIMIT = fail("You have reached the hourly limit for the career tools. Please try again later.");
const allow = async (userId: string) => (await rateLimit(`tools:${userId}`, 40, 3600)).ok;

// ── A. Resume Analyzer ───────────────────────────────────────────────
const resumeAi = z.object({
  summary: z.string().describe("Three or four sentences: an honest overall read of this resume for the target role."),
  priorities: z.array(z.string()).max(5).describe("The most valuable changes, most important first."),
  rewrites: z.array(z.object({ before: z.string(), after: z.string(), why: z.string() })).max(3).describe("Up to three bullets rewritten using only facts already in the resume."),
});

export async function analyzeResumeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const jdText = String(fd.get("jd_text") ?? "").trim().slice(0, 20000);
  const jdTitle = String(fd.get("jd_title") ?? "").trim().slice(0, 120);
  if (jdText && jdText.length < 80) return fail("Please correct the highlighted fields.", { jd_text: ["Paste the full job description (at least a few lines), or leave it empty."] });

  let upload, resumeText: string;
  try {
    upload = await validateUpload(fd.get("resume") as File | null, "document");
    resumeText = await extractText(upload.buffer, upload.ext);
  } catch (e) {
    if (e instanceof UploadError || e instanceof ResumeParseError) return fail(e.message, { resume: [e.message] });
    throw e;
  }
  const parsed = parseResume(resumeText);
  const job = jdText ? parseJobDescription(jdText, jdTitle) : null;
  const analysis = analyzeResume(parsed, job);

  const enriched = await tryEnrich((ai) => ai.json({
    system: `${SAFETY_PREAMBLE}\nYou review resumes for cybersecurity roles. Base every statement on the resume text. Rewrites must not add tools, employers, numbers or achievements that are not already present.`,
    prompt: `<resume>\n${resumeText}\n</resume>\n${jdText ? `<job_description>\n${jdText}\n</job_description>\n` : ""}<rule_based_findings>\n${JSON.stringify({ scores: analysis.scores, improvements: analysis.improvements, jobMatch: analysis.jobMatch })}\n</rule_based_findings>\nReview this resume${job ? ` against the job description for “${job.title}”` : ""}.`,
    schema: resumeAi,
  }));

  const file = await storeFile(viewer, "resumes", upload);
  const id = await withUser(viewer, async (sql) => {
    const [resume] = await sql`insert into resumes (user_id, file_id, parsed_text, parsed) values (${viewer.id}, ${file.id}, ${resumeText}, ${sql.json(parsed as never)}) returning id`;
    const [jd] = job ? await sql`insert into job_descriptions (user_id, title, raw_text, parsed) values (${viewer.id}, ${job.title}, ${jdText}, ${sql.json(job as never)}) returning id` : [];
    const [row] = await sql`insert into resume_analyses (user_id, resume_id, job_description_id, engine, model, result)
      values (${viewer.id}, ${resume.id}, ${jd?.id ?? null}, ${enriched.engine}, ${enriched.model}, ${sql.json({ analysis, ai: enriched.data, note: enriched.note, fileName: upload.name, jobTitle: job?.title ?? null } as never)}) returning id`;
    return row.id as string;
  });
  await audit(viewer, "tool.resume_analyzed", "resume_analysis", id, { engine: enriched.engine });
  redirect(`/portal/tools/resume-analyzer/${id}`);
}

// ── D. Job Description Analyser ──────────────────────────────────────
const jdAi = z.object({
  summary: z.string().describe("Two or three sentences on what this role really involves day to day."),
  hiddenExpectations: z.array(z.string()).max(4).describe("Expectations implied but not stated outright."),
  questionsToAsk: z.array(z.string()).max(4).describe("Good questions for the candidate to ask the employer."),
});
const jdSchema = z.object({ title: optionalText(120), company: optionalText(120), jd_text: text(20000, 80) });

export async function analyzeJobAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const p = parseForm(jdSchema, fd);
  if (p.error) return p.error;
  const job = parseJobDescription(p.data.jd_text, p.data.title ?? undefined);
  const enriched = await tryEnrich((ai) => ai.json({
    system: `${SAFETY_PREAMBLE}\nYou help candidates understand cybersecurity job descriptions. Do not speculate about salary or about the candidate's chances.`,
    prompt: `<job_description>\n${p.data.jd_text}\n</job_description>\nExplain this posting for a candidate preparing to apply.`,
    schema: jdAi,
  }));
  const [row] = await withUser(viewer, (sql) => sql`insert into job_descriptions (user_id, title, company, raw_text, parsed)
    values (${viewer.id}, ${job.title}, ${p.data.company ?? ""}, ${p.data.jd_text}, ${sql.json({ ...job, ai: enriched.data, note: enriched.note, engine: enriched.engine } as never)}) returning id`);
  await audit(viewer, "tool.jd_analyzed", "job_description", row.id, { engine: enriched.engine });
  redirect(`/portal/tools/jd-analyser/${row.id}`);
}

// ── B. Career Advisor ────────────────────────────────────────────────
const advisorAi = z.object({
  commentary: z.string().describe("A short, candid paragraph on this learner's position and the most sensible route for them."),
  weeklyPlan: z.array(z.string()).max(5).describe("Concrete weekly habits for the next month, sized to their available hours."),
  watchOuts: z.array(z.string()).max(3).describe("Realistic risks or misconceptions to be aware of."),
});
const advisorSchema = z.object({
  target_role: z.string().refine((v) => ROLE_BY_ID.has(v), "Choose a target role"),
  experience_level: z.enum(["none", "it-0-2", "it-3-plus", "security"]),
  hours_per_week: z.coerce.number().int().min(2, "At least 2").max(40, "At most 40"),
  skills_text: optionalText(1500), goals: optionalText(1000),
});

export async function runCareerAdvisor(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const p = parseForm(advisorSchema, fd);
  if (p.error) return p.error;
  const pick = (name: string, valid: (v: string) => boolean) => fd.getAll(name).filter((v): v is string => typeof v === "string" && valid(v)).slice(0, 80);
  const input = {
    targetRole: p.data.target_role, currentSkills: pick("skills", (v) => SKILL_BY_ID.has(v)), heldCerts: pick("certs", (v) => CERTS.some((c) => c.id === v)),
    skillsText: p.data.skills_text ?? undefined, experienceLevel: p.data.experience_level, hoursPerWeek: p.data.hours_per_week, goals: p.data.goals ?? undefined,
  };
  const result = assessCareer(input);
  const enriched = await tryEnrich((ai) => ai.json({
    system: `${SAFETY_PREAMBLE}\nYou are a career adviser for people entering cybersecurity in the USA, UK and Canada. Be encouraging but realistic about timelines and competition.`,
    prompt: `<learner>\n${JSON.stringify({ goals: input.goals, background: input.skillsText, experience: input.experienceLevel, hoursPerWeek: input.hoursPerWeek })}\n</learner>\n<assessment>\n${JSON.stringify({ role: result.role.title, gap: result.gap, readiness: result.readiness, roadmap: result.roadmap, certifications: result.certifications })}\n</assessment>\nGive personalised advice that builds on this assessment.`,
    schema: advisorAi,
  }));
  const [row] = await withUser(viewer, (sql) => sql`insert into career_assessments (user_id, target_role, input, result, engine)
    values (${viewer.id}, ${input.targetRole}, ${sql.json(input as never)}, ${sql.json({ ...result, ai: enriched.data, note: enriched.note } as never)}, ${enriched.engine}) returning id`);
  await audit(viewer, "tool.career_assessed", "career_assessment", row.id, { engine: enriched.engine });
  revalidatePath("/portal", "layout");
  redirect(`/portal/tools/career-advisor?id=${row.id}`);
}

// ── C. Interview Coach ───────────────────────────────────────────────
const interviewSchema = z.object({
  target_role: z.string().refine((v) => ROLE_BY_ID.has(v), "Choose a role"),
  mode: z.enum(["technical", "behavioural", "mixed"]),
  jd_text: optionalText(20000),
});
const tailoredAi = z.object({
  questions: z.array(z.object({
    question: z.string(), category: z.enum(["technical", "scenario", "behavioural"]),
    structure: z.array(z.string()).max(5),
    keyPoints: z.array(z.object({ label: z.string(), keywords: z.array(z.string()).max(6) })).max(6),
    followUps: z.array(z.string()).max(2),
  })).max(2),
});

export async function startInterview(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const p = parseForm(interviewSchema, fd);
  if (p.error) return p.error;
  const resumeId = fd.get("resume_id"), jdId = fd.get("jd_id");
  let resumeFile: { id: string } | null = null, uploadedText: string | null = null;
  const file = fd.get("resume");
  if (file instanceof File && file.size > 0) {
    try {
      const upload = await validateUpload(file, "document");
      uploadedText = await extractText(upload.buffer, upload.ext);
      resumeFile = await storeFile(viewer, "resumes", upload);
    } catch (e) {
      if (e instanceof UploadError || e instanceof ResumeParseError) return fail(e.message, { resume: [e.message] });
      throw e;
    }
  }
  if (p.data.jd_text && p.data.jd_text.length < 80) return fail("Please correct the highlighted fields.", { jd_text: ["Paste the full job description, or leave it empty."] });

  const ctx = await withUser(viewer, async (sql) => {
    let resume: { id: string; parsed: ParsedResume; parsed_text: string } | undefined;
    if (uploadedText) {
      const parsed = parseResume(uploadedText);
      const [r] = await sql`insert into resumes (user_id, file_id, parsed_text, parsed) values (${viewer.id}, ${resumeFile!.id}, ${uploadedText}, ${sql.json(parsed as never)}) returning id`;
      resume = { id: r.id, parsed, parsed_text: uploadedText };
    } else if (isUuid(resumeId)) {
      [resume] = await sql<{ id: string; parsed: ParsedResume; parsed_text: string }[]>`select id, parsed, parsed_text from resumes where id = ${resumeId}`;
    }
    let job: { id: string; parsed: ParsedJob; raw_text: string } | undefined;
    if (p.data.jd_text) {
      const parsed = parseJobDescription(p.data.jd_text);
      const [j] = await sql`insert into job_descriptions (user_id, title, raw_text, parsed) values (${viewer.id}, ${parsed.title}, ${p.data.jd_text}, ${sql.json(parsed as never)}) returning id`;
      job = { id: j.id, parsed, raw_text: p.data.jd_text };
    } else if (isUuid(jdId)) {
      [job] = await sql<{ id: string; parsed: ParsedJob; raw_text: string }[]>`select id, parsed, raw_text from job_descriptions where id = ${jdId}`;
    }
    return { resume, job };
  });

  const questions = generateQuestions({ role: p.data.target_role, mode: p.data.mode, resume: ctx.resume?.parsed, job: ctx.job?.parsed, seed: Date.now() % 100000 });
  const enriched = (ctx.resume || ctx.job) ? await tryEnrich((ai) => ai.json({
    system: `${SAFETY_PREAMBLE}\nYou write interview questions for cybersecurity roles. Each question must be specific to this candidate's resume or this job description. Key-point keywords must be short lower-case phrases a good answer would contain.`,
    prompt: `Role: ${ROLE_BY_ID.get(p.data.target_role)!.title}. Mode: ${p.data.mode}.\n${ctx.resume ? `<resume>\n${ctx.resume.parsed_text}\n</resume>\n` : ""}${ctx.job ? `<job_description>\n${ctx.job.raw_text}\n</job_description>\n` : ""}Write up to two additional interview questions that an interviewer would ask this specific candidate. Do not repeat these existing questions:\n${questions.map((q) => `- ${q.question}`).join("\n")}`,
    schema: tailoredAi,
  })) : { data: null, engine: "rules", model: null, note: null };
  const tailored = (enriched.data?.questions ?? []).map((q) => ({ category: q.category, question: q.question, guidance: { structure: q.structure, keyPoints: q.keyPoints, anchor: "Written for your resume and this job description." }, followUps: q.followUps }));
  const all = [...questions.slice(0, -1), ...tailored, questions[questions.length - 1]];

  const id = await withUser(viewer, async (sql) => {
    const [s] = await sql`insert into interview_sessions (user_id, resume_id, job_description_id, target_role, mode, engine) values (${viewer.id}, ${ctx.resume?.id ?? null}, ${ctx.job?.id ?? null}, ${p.data.target_role}, ${p.data.mode}, ${enriched.engine}) returning id`;
    for (const [i, q] of all.entries()) {
      await sql`insert into interview_questions (session_id, user_id, position, category, question, guidance, follow_ups) values (${s.id}, ${viewer.id}, ${i}, ${q.category}, ${q.question}, ${sql.json(q.guidance as never)}, ${sql.json(q.followUps)})`;
    }
    return s.id as string;
  });
  await audit(viewer, "tool.interview_started", "interview_session", id, { engine: enriched.engine });
  redirect(`/portal/tools/interview-coach/${id}`);
}

const answerAi = z.object({
  feedback: z.string().describe("Three or four sentences of specific coaching on this answer."),
  improvedOutline: z.array(z.string()).max(5).describe("A bullet outline of a stronger answer using only what the candidate actually said plus the expected points."),
});

export async function answerQuestion(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const p = parseForm(z.object({ question_id: z.uuid(), answer: text(6000, 20) }), fd);
  if (p.error) return p.error;
  const [q] = await withUser(viewer, (sql) => sql`select q.*, s.status as session_status, s.target_role from interview_questions q join interview_sessions s on s.id = q.session_id where q.id = ${p.data.question_id}`);
  if (!q) return fail("Question not found.");
  if (q.session_status !== "in_progress") return fail("This session is already complete.");
  const feedback: AnswerFeedback = evaluateAnswer({ category: q.category, guidance: q.guidance, followUps: q.follow_ups }, p.data.answer);
  const enriched = await tryEnrich((ai) => ai.json({
    system: `${SAFETY_PREAMBLE}\nYou are an interview coach for cybersecurity roles. Coach on substance and structure. Do not grade likelihood of being hired.`,
    prompt: `<question>${q.question}</question>\n<expected_points>${JSON.stringify((q.guidance.keyPoints ?? []).map((k: { label: string }) => k.label))}</expected_points>\n<candidate_answer>\n${p.data.answer}\n</candidate_answer>\nCoach the candidate on this answer.`,
    schema: answerAi,
  }));
  if (enriched.data) feedback.ai = enriched.data;
  await withUser(viewer, (sql) => sql`update interview_questions set answer = ${p.data.answer}, feedback = ${sql.json(feedback as never)}, score = ${feedback.score}, answered_at = now() where id = ${q.id}`);
  revalidatePath(`/portal/tools/interview-coach/${q.session_id}`);
  return ok(enriched.note ?? "Feedback ready.");
}

export async function completeInterview(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  const id = fd.get("session_id");
  if (!isUuid(id)) return fail("Invalid request.");
  const done = await withUser(viewer, async (sql) => {
    const qs = await sql`select category, score, feedback from interview_questions where session_id = ${id} order by position`;
    if (!qs.some((q) => q.score != null)) return false;
    await sql`update interview_sessions set status = 'completed', completed_at = now(), summary = ${sql.json(summariseSession(qs as never) as never)} where id = ${id} and status = 'in_progress'`;
    return true;
  });
  if (!done) return fail("Answer at least one question before finishing.");
  await audit(viewer, "tool.interview_completed", "interview_session", id);
  revalidatePath(`/portal/tools/interview-coach/${id}`);
  revalidatePath("/portal", "layout");
  return ok("Session complete.");
}

// ── E. Cybersecurity Learning Assistant ──────────────────────────────
export async function askAssistant(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await allow(viewer.id))) return LIMIT;
  const p = parseForm(z.object({ topic: z.string(), question: text(1500, 5) }), fd);
  if (p.error) return p.error;
  const topic = (TOPICS.find((t) => t.id === p.data.topic)?.id ?? null) as Topic | null;
  const kb = answerFromKnowledge(p.data.question, topic);
  const notes = searchKnowledge(p.data.question, topic, 4);
  const enriched = await tryEnrich((ai) => ai.text({
    system: `${SAFETY_PREAMBLE}\nYou are the SkillXGen learning assistant for SOC analysis, SIEM practice, incident response, phishing analysis and threat hunting. Explain step by step, use Markdown, and end with one short practice task. If the question falls outside defensive security education, say so briefly.`,
    prompt: `${notes.length ? `<study_notes>\n${notes.map((n) => `## ${n.title}\n${n.body}`).join("\n\n")}\n</study_notes>\n` : ""}<learner_question topic="${topic ?? "general"}">\n${p.data.question}\n</learner_question>`,
  }));
  const answer = enriched.data?.trim() || kb.text;
  await withUser(viewer, (sql) => sql`insert into learning_sessions (user_id, topic, prompt, response, engine) values (${viewer.id}, ${topic ?? "general"}, ${p.data.question}, ${answer}, ${enriched.engine})`);
  revalidatePath("/portal/tools/learning-assistant");
  return ok(enriched.note ?? undefined, { answer, engine: enriched.engine, sources: kb.sources });
}
