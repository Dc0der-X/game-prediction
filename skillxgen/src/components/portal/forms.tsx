"use client";
import { ActionForm, CheckboxField, Field, InlineAction, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { createTicket, markNotificationsRead, replyToTicket, requestData, submitAssignment, updateProfile } from "@/app/portal/actions";
import { CAREER_LEVELS, COUNTRIES } from "@/lib/forms";

type Profile = { full_name: string; headline: string | null; bio: string | null; target_role: string | null; linkedin_url: string | null; country: string | null; career_level: string | null; marketing_consent: boolean };

export function ProfileForm({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateProfile} data-testid="profile-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="full_name" label="Full name"><Input defaultValue={profile.full_name} required /></Field>
        <Field name="headline" label="Headline"><Input defaultValue={profile.headline ?? ""} placeholder="e.g. IT support technician moving into SOC work" /></Field>
        <Field name="country" label="Country"><Select defaultValue={profile.country ?? ""}><option value="">Select…</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field name="career_level" label="Career level"><Select defaultValue={profile.career_level ?? ""}><option value="">Select…</option>{CAREER_LEVELS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field name="target_role" label="Target role"><Input defaultValue={profile.target_role ?? ""} /></Field>
        <Field name="linkedin_url" label="LinkedIn URL"><Input type="url" defaultValue={profile.linkedin_url ?? ""} placeholder="https://www.linkedin.com/in/…" /></Field>
      </div>
      <Field name="bio" label="About you"><Textarea rows={4} defaultValue={profile.bio ?? ""} /></Field>
      <CheckboxField name="marketing_consent" defaultChecked={profile.marketing_consent}>Email me occasional free labs, webinars and programme news.</CheckboxField>
      <SubmitButton>Save profile</SubmitButton>
    </ActionForm>
  );
}

export function DataRequestForms() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ActionForm action={requestData} className="space-y-3">
        <input type="hidden" name="type" value="export" />
        <p className="text-sm text-muted">Log a formal request for a copy of your data. You can also download it instantly.</p>
        <SubmitButton variant="outline" size="sm">Log export request</SubmitButton>
      </ActionForm>
      <ActionForm action={requestData} className="space-y-3" data-testid="deletion-form">
        <input type="hidden" name="type" value="deletion" />
        <Field name="confirm" label="Type DELETE to request account deletion"><Input autoComplete="off" /></Field>
        <SubmitButton variant="destructive" size="sm">Request deletion</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function SubmissionForm({ assignmentId, content, link, resubmit }: { assignmentId: string; content?: string; link?: string | null; resubmit: boolean }) {
  return (
    <ActionForm action={submitAssignment} data-testid="submission-form">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <Field name="content" label="Your work" hint="Paste your write-up. Markdown is supported. Minimum 20 characters."><Textarea rows={12} defaultValue={content ?? ""} className="font-mono text-xs" required /></Field>
      <Field name="link_url" label="Link (optional)" hint="A public repository or document, if relevant."><Input type="url" defaultValue={link ?? ""} placeholder="https://" /></Field>
      <Field name="file" label="Attachment (optional)" hint="PDF, DOCX, PNG, JPG or WEBP. Up to 8 MB."><Input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" /></Field>
      <SubmitButton pendingLabel="Submitting…">{resubmit ? "Resubmit" : "Submit for review"}</SubmitButton>
    </ActionForm>
  );
}

export function TicketForm() {
  return (
    <ActionForm action={createTicket} data-testid="ticket-form">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field name="subject" label="Subject"><Input required /></Field>
        <Field name="category" label="Category"><Select defaultValue="general"><option value="general">General</option><option value="technical">Technical</option><option value="course">Course content</option><option value="career">Career support</option><option value="billing">Billing and refunds</option></Select></Field>
      </div>
      <Field name="body" label="How can we help?"><Textarea rows={5} required /></Field>
      <SubmitButton pendingLabel="Sending…">Send request</SubmitButton>
    </ActionForm>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <ActionForm action={replyToTicket} resetOnSuccess>
      <input type="hidden" name="ticket_id" value={ticketId} />
      <Field name="body" label="Reply"><Textarea rows={4} required /></Field>
      <SubmitButton>Send reply</SubmitButton>
    </ActionForm>
  );
}

export function MarkRead({ id }: { id?: string }) {
  return <InlineAction action={markNotificationsRead} fields={id ? { id } : {}} variant="ghost">{id ? "Mark read" : "Mark all as read"}</InlineAction>;
}
