import { service } from "./db";
import { emitEvent } from "./events";

export const LEAD_STAGES = ["new", "contacted", "qualified", "consultation_booked", "consultation_completed", "offer_sent", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const CONSENT_TEXT = "I agree to SkillXGen contacting me about this enquiry and sending occasional emails about free resources, webinars and programmes. I can unsubscribe at any time.";

export type LeadInput = {
  name: string; email: string; source: string;
  country?: string | null; career_level?: string | null; current_skills?: string | null; target_role?: string | null;
  programme_interest?: string | null; budget_range?: string | null; message?: string | null;
  consent: boolean;
  interaction: { type: "enquiry" | "consultation_request" | "webinar_registration" | "resource_download" | "assessment"; summary: string; details?: Record<string, unknown> };
};

/**
 * Creates or updates the lead for an email address and records the interaction (enquiry history).
 * Consent is only ever switched on here, with a timestamp and the wording shown; withdrawing it is the unsubscribe flow.
 */
export async function captureLead(input: LeadInput): Promise<{ id: string; unsubscribeToken: string; created: boolean }> {
  const sql = service();
  const result = await sql.begin(async (tx) => {
    const [lead] = await tx`
      insert into leads (name, email, country, career_level, current_skills, target_role, programme_interest, budget_range, source, message, consent_marketing, consent_at, consent_text, profile_id)
      values (${input.name}, ${input.email}, ${input.country ?? null}, ${input.career_level ?? null}, ${input.current_skills ?? null}, ${input.target_role ?? null},
        ${input.programme_interest ?? null}, ${input.budget_range ?? null}, ${input.source}, ${input.message ?? null}, ${input.consent}, ${input.consent ? sql`now()` : null}, ${input.consent ? CONSENT_TEXT : null},
        (select id from profiles where email = ${input.email}))
      on conflict (email) do update set
        name = excluded.name,
        country = coalesce(excluded.country, leads.country),
        career_level = coalesce(excluded.career_level, leads.career_level),
        current_skills = coalesce(excluded.current_skills, leads.current_skills),
        target_role = coalesce(excluded.target_role, leads.target_role),
        programme_interest = coalesce(excluded.programme_interest, leads.programme_interest),
        budget_range = coalesce(excluded.budget_range, leads.budget_range),
        message = coalesce(excluded.message, leads.message),
        consent_marketing = leads.consent_marketing or excluded.consent_marketing,
        consent_at = case when excluded.consent_marketing and not leads.consent_marketing then now() else leads.consent_at end,
        consent_text = case when excluded.consent_marketing and not leads.consent_marketing then excluded.consent_text else leads.consent_text end,
        unsubscribed_at = case when excluded.consent_marketing then null else leads.unsubscribed_at end
      returning id, unsubscribe_token, (xmax = 0) as created`;
    await tx`insert into lead_interactions (lead_id, type, summary, details) values (${lead.id}, ${input.interaction.type}, ${input.interaction.summary}, ${sql.json((input.interaction.details ?? {}) as never)})`;
    return lead;
  });
  if (result.created) emitEvent("lead.created", { lead_id: result.id, source: input.source, programme_interest: input.programme_interest ?? null });
  return { id: result.id, unsubscribeToken: result.unsubscribe_token, created: result.created };
}

export async function unsubscribe(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const sql = service();
  const [lead] = await sql`update leads set consent_marketing = false, unsubscribed_at = now() where unsubscribe_token = ${token} returning id, email`;
  if (!lead) return false;
  await sql`update profiles set marketing_consent = false where email = ${lead.email}`;
  await sql`insert into lead_interactions (lead_id, type, summary) values (${lead.id}, 'system', 'Unsubscribed from marketing email via unsubscribe link')`;
  return true;
}
