"use client";
import { useActionState } from "react";
import { ActionForm, Field, InlineAction, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Alert } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { analyzeJobAction, analyzeResumeAction, answerQuestion, askAssistant, completeInterview, runCareerAdvisor, startInterview } from "@/app/portal/tools/actions";

type Opt = { id: string; label: string };

export function ResumeUploadForm() {
  return (
    <ActionForm action={analyzeResumeAction} data-testid="resume-form">
      <Field name="resume" label="Resume file" hint="PDF or DOCX, up to 5 MB. Stored privately in your account."><Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required /></Field>
      <Field name="jd_title" label="Job title (optional)"><Input placeholder="e.g. SOC Analyst (Tier 1)" /></Field>
      <Field name="jd_text" label="Job description (optional)" hint="Paste a posting to see which required skills your resume covers."><Textarea rows={7} /></Field>
      <SubmitButton pendingLabel="Analysing…">Analyse resume</SubmitButton>
    </ActionForm>
  );
}

export function JobForm() {
  return (
    <ActionForm action={analyzeJobAction} data-testid="jd-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label="Job title (optional)"><Input /></Field>
        <Field name="company" label="Company (optional)"><Input /></Field>
      </div>
      <Field name="jd_text" label="Job description" hint="Paste the full text of the posting."><Textarea rows={12} required /></Field>
      <SubmitButton pendingLabel="Analysing…">Analyse job description</SubmitButton>
    </ActionForm>
  );
}

export function AdvisorForm({ roles, skills, certs }: { roles: Opt[]; skills: { category: string; items: Opt[] }[]; certs: Opt[] }) {
  const chip = "cursor-pointer rounded-sm border border-border px-2.5 py-1.5 text-xs text-muted transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-foreground";
  return (
    <ActionForm action={runCareerAdvisor} className="space-y-6" data-testid="advisor-form">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="target_role" label="Target role"><Select defaultValue="soc-analyst">{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
        <Field name="experience_level" label="Experience"><Select defaultValue="none"><option value="none">No IT experience yet</option><option value="it-0-2">IT, up to 2 years</option><option value="it-3-plus">IT, 3+ years</option><option value="security">Already in security</option></Select></Field>
        <Field name="hours_per_week" label="Study hours per week"><Input type="number" min={2} max={40} defaultValue={10} /></Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Current skills — tick what you can already do or explain</legend>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {skills.map((g) => <div key={g.category}><p className="kicker mb-2">{g.category}</p><div className="flex flex-wrap gap-2">{g.items.map((s) => <label key={s.id} className={chip}><input type="checkbox" name="skills" value={s.id} className="sr-only" />{s.label}</label>)}</div></div>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">Certifications you already hold</legend>
        <div className="mt-3 flex flex-wrap gap-2">{certs.map((c) => <label key={c.id} className={chip}><input type="checkbox" name="certs" value={c.id} className="sr-only" />{c.label}</label>)}</div>
      </fieldset>
      <Field name="skills_text" label="Anything else about your background? (optional)" hint="Skills mentioned here are recognised automatically."><Textarea rows={3} /></Field>
      <Field name="goals" label="Career goals (optional)"><Textarea rows={3} placeholder="e.g. A remote SOC role within 12 months; currently working full-time in retail management." /></Field>
      <SubmitButton pendingLabel="Building roadmap…">Build my roadmap</SubmitButton>
    </ActionForm>
  );
}

export function InterviewStartForm({ roles, resumes, jobs }: { roles: Opt[]; resumes: Opt[]; jobs: Opt[] }) {
  return (
    <ActionForm action={startInterview} data-testid="interview-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="target_role" label="Role"><Select defaultValue="soc-analyst">{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
        <Field name="mode" label="Interview type"><Select defaultValue="mixed"><option value="mixed">Mixed (technical and behavioural)</option><option value="technical">Technical</option><option value="behavioural">Behavioural</option></Select></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="resume_id" label="Use a saved resume"><Select defaultValue={resumes[0]?.id ?? ""}><option value="">None</option>{resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</Select></Field>
        <Field name="resume" label="…or upload a resume" hint="PDF or DOCX, up to 5 MB."><Input type="file" accept=".pdf,.docx" /></Field>
      </div>
      <Field name="jd_id" label="Use a saved job description"><Select defaultValue=""><option value="">None</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}</Select></Field>
      <Field name="jd_text" label="…or paste a job description" hint="Questions are prioritised around the skills this posting asks for."><Textarea rows={5} /></Field>
      <SubmitButton pendingLabel="Preparing questions…">Start practice interview</SubmitButton>
    </ActionForm>
  );
}

export function AnswerForm({ questionId, existing }: { questionId: string; existing?: string | null }) {
  return (
    <ActionForm action={answerQuestion} data-testid="answer-form">
      <input type="hidden" name="question_id" value={questionId} />
      <Field name="answer" label={existing ? "Revise your answer" : "Your answer"} hint="Write it as you would say it. Aim for 150–300 words."><Textarea rows={7} defaultValue={existing ?? ""} required /></Field>
      <SubmitButton pendingLabel="Reviewing…">{existing ? "Resubmit for feedback" : "Get feedback"}</SubmitButton>
    </ActionForm>
  );
}

export function FinishInterview({ sessionId }: { sessionId: string }) {
  return <InlineAction action={completeInterview} fields={{ session_id: sessionId }} variant="default" size="default" data-testid="finish-interview">Finish session and see summary</InlineAction>;
}

export function AssistantForm({ topics }: { topics: Opt[] }) {
  const [state, action] = useActionState(askAssistant, null);
  const data = state?.ok ? (state.data as { answer: string; engine: string; sources: string[] }) : null;
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" data-testid="assistant-form">
        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <div className="space-y-1.5"><label htmlFor="la-topic" className="text-sm font-medium">Topic</label><Select id="la-topic" name="topic" defaultValue={topics[0].id}>{topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></div>
          <div className="space-y-1.5"><label htmlFor="la-q" className="text-sm font-medium">Your question</label><Input id="la-q" name="question" required placeholder="e.g. How do I tell brute force from password spraying in logs?" />{state?.errors?.question ? <p className="text-xs text-danger">{state.errors.question[0]}</p> : null}</div>
        </div>
        <SubmitButton pendingLabel="Thinking…">Ask</SubmitButton>
      </form>
      {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      {data ? (
        <div className="rounded-lg border border-border-strong bg-card p-6" data-testid="assistant-answer">
          <p className="kicker mb-3">{data.engine === "rules" ? "From the SkillXGen study notes" : "AI tutor, grounded in the study notes"}</p>
          {state?.message ? <Alert tone="warning" className="mb-4">{state.message}</Alert> : null}
          <Markdown>{data.answer}</Markdown>
        </div>
      ) : null}
    </div>
  );
}
