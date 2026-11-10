"use client";
import { useActionState } from "react";
import Link from "next/link";
import { ActionForm, CheckboxField, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Alert, Badge, Card, CardContent } from "@/components/ui/card";
import { registerForResource, registerForWebinar, submitCareerAssessment, submitEnquiry } from "@/app/(site)/actions";
import { BUDGET_RANGES, CAREER_LEVELS, COUNTRIES } from "@/lib/forms";
import type { AdvisorResult } from "@/lib/career/advisor";

const CONSENT = "Email me occasional free labs, webinars and programme news. Optional — unsubscribe any time.";
const Honeypot = () => <div className="hidden" aria-hidden><label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>;
const Options = ({ values, placeholder }: { values: readonly string[]; placeholder: string }) => <><option value="">{placeholder}</option>{values.map((v) => <option key={v} value={v}>{v}</option>)}</>;

export function EnquiryForm({ kind, programme, programmes = [], compact = false }: { kind: "contact" | "programme_enquiry" | "consultation_request"; programme?: string; programmes?: string[]; compact?: boolean }) {
  return (
    <ActionForm action={submitEnquiry} successReplaces data-testid={`form-${kind}`}>
      <input type="hidden" name="kind" value={kind} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Full name"><Input autoComplete="name" required /></Field>
        <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
        <Field name="country" label="Country"><Select><Options values={COUNTRIES} placeholder="Select…" /></Select></Field>
        <Field name="career_level" label="Where are you now?"><Select><Options values={CAREER_LEVELS} placeholder="Select…" /></Select></Field>
      </div>
      {programme ? <input type="hidden" name="programme_interest" value={programme} /> : (
        <Field name="programme_interest" label="What are you interested in?"><Select><Options values={programmes} placeholder="Not sure yet" /></Select></Field>
      )}
      {!compact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="target_role" label="Target role (optional)"><Input placeholder="e.g. SOC Analyst" /></Field>
          <Field name="budget_range" label="Budget (optional)"><Select><Options values={BUDGET_RANGES} placeholder="Prefer not to say" /></Select></Field>
        </div>
      ) : null}
      {!compact ? <Field name="current_skills" label="Current skills or background (optional)"><Input placeholder="e.g. 3 years in IT support, studying for Security+" /></Field> : null}
      <Field name="message" label={kind === "consultation_request" ? "What would you like to cover on the call?" : "Message"}><Textarea rows={4} /></Field>
      <CheckboxField name="consent">{CONSENT}</CheckboxField>
      <p className="text-xs text-subtle">We use your details to respond to this enquiry. See our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      <SubmitButton pendingLabel="Sending…">{kind === "consultation_request" ? "Request a consultation" : "Send enquiry"}</SubmitButton>
    </ActionForm>
  );
}

export function WebinarForm({ webinarId }: { webinarId: string }) {
  return (
    <ActionForm action={registerForWebinar} successReplaces data-testid="form-webinar">
      <input type="hidden" name="webinar_id" value={webinarId} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Full name"><Input autoComplete="name" required /></Field>
        <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      </div>
      <Field name="country" label="Country"><Select><Options values={COUNTRIES} placeholder="Select…" /></Select></Field>
      <CheckboxField name="consent">{CONSENT}</CheckboxField>
      <SubmitButton pendingLabel="Registering…">Register free</SubmitButton>
    </ActionForm>
  );
}

export function ResourceUpdatesForm({ resource }: { resource: string }) {
  return (
    <ActionForm action={registerForResource} successReplaces data-testid="form-resource">
      <input type="hidden" name="resource" value={resource} />
      <Honeypot />
      <Field name="name" label="Name"><Input autoComplete="name" required /></Field>
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <CheckboxField name="consent">Yes, email me new free labs and guides. Unsubscribe any time.</CheckboxField>
      <SubmitButton variant="outline" pendingLabel="Saving…">Get new free resources by email</SubmitButton>
    </ActionForm>
  );
}

export function CareerAssessmentForm({ roles, skills }: { roles: { id: string; title: string }[]; skills: { category: string; items: { id: string; label: string }[] }[] }) {
  const [state, action] = useActionState(submitCareerAssessment, null);
  const result = state?.ok ? (state.data?.result as AdvisorResult) : null;
  if (result) return <AssessmentResult result={result} />;
  return (
    <form action={action} className="space-y-6" noValidate data-testid="form-assessment">
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><label htmlFor="a-name" className="text-sm font-medium">Full name</label><Input id="a-name" name="name" required autoComplete="name" />{state?.errors?.name ? <p className="text-xs text-danger">{state.errors.name[0]}</p> : null}</div>
        <div className="space-y-1.5"><label htmlFor="a-email" className="text-sm font-medium">Email</label><Input id="a-email" name="email" type="email" required autoComplete="email" />{state?.errors?.email ? <p className="text-xs text-danger">{state.errors.email[0]}</p> : null}</div>
        <div className="space-y-1.5"><label htmlFor="a-role" className="text-sm font-medium">Target role</label><Select id="a-role" name="target_role" defaultValue="soc-analyst">{roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</Select></div>
        <div className="space-y-1.5"><label htmlFor="a-exp" className="text-sm font-medium">Experience</label><Select id="a-exp" name="experience_level" defaultValue="none"><option value="none">No IT experience yet</option><option value="it-0-2">IT, up to 2 years</option><option value="it-3-plus">IT, 3+ years</option><option value="security">Already in security</option></Select></div>
        <div className="space-y-1.5"><label htmlFor="a-hours" className="text-sm font-medium">Study hours per week</label><Input id="a-hours" name="hours_per_week" type="number" min={2} max={40} defaultValue={10} /></div>
        <div className="space-y-1.5"><label htmlFor="a-country" className="text-sm font-medium">Country</label><Select id="a-country" name="country"><Options values={COUNTRIES} placeholder="Select…" /></Select></div>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Which of these can you already do or explain? Be honest — it makes the plan useful.</legend>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {skills.map((g) => (
            <div key={g.category}>
              <p className="kicker mb-2">{g.category}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((s) => (
                  <label key={s.id} className="cursor-pointer rounded-sm border border-border px-2.5 py-1.5 text-xs text-muted transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-foreground">
                    <input type="checkbox" name="skills" value={s.id} className="sr-only" />{s.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-3 text-sm text-muted"><input type="checkbox" name="consent" className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span>{CONSENT}</span></label>
      {state && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <SubmitButton pendingLabel="Assessing…">Show my skills gap</SubmitButton>
    </form>
  );
}

function AssessmentResult({ result }: { result: AdvisorResult }) {
  return (
    <div className="space-y-6" data-testid="assessment-result">
      <Card><CardContent>
        <p className="kicker">Target role</p>
        <h3 className="mt-2 text-2xl font-semibold">{result.role.title}</h3>
        <p className="mt-1 text-sm text-muted">{result.role.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3"><Badge variant="primary">{result.readiness.band}</Badge><span className="text-sm text-muted">{result.gap.coreCoverage}% of core skills self-reported · about {result.totalWeeks} weeks of study at your pace</span></div>
      </CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent><p className="kicker mb-3">Core skills to build</p>{result.gap.coreMissing.length ? <ul className="space-y-1.5 text-sm text-muted">{result.gap.coreMissing.map((s) => <li key={s}>— {s}</li>)}</ul> : <p className="text-sm text-muted">You report all core skills. Focus on evidence and interview practice.</p>}</CardContent></Card>
        <Card><CardContent><p className="kicker mb-3">Already in place</p>{result.gap.coreHave.length ? <ul className="space-y-1.5 text-sm text-muted">{result.gap.coreHave.map((s) => <li key={s}>✓ {s}</li>)}</ul> : <p className="text-sm text-muted">Nothing yet — everyone starts here. The free academy covers the foundations.</p>}</CardContent></Card>
      </div>
      <Card><CardContent><p className="kicker mb-3">Suggested next steps</p><ol className="list-decimal space-y-2 pl-5 text-sm text-muted">{result.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol></CardContent></Card>
      <p className="text-xs text-subtle">{result.disclaimer}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/sign-up" className="text-sm font-medium text-primary-hover hover:underline">Create a free account for the full roadmap →</Link>
        <Link href={`/programmes/${result.role.programme}`} className="text-sm font-medium text-muted hover:text-foreground">See the related programme →</Link>
      </div>
    </div>
  );
}
