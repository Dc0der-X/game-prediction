"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { BUDGET_RANGES, CAREER_LEVELS, COUNTRIES, checkbox, email, fail, ok, optionalText, parseForm, text, type ActionState } from "@/lib/forms";
import { rateLimitByIp } from "@/lib/security";
import { captureLead } from "@/lib/crm";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { service } from "@/lib/db";
import { getViewer } from "@/lib/auth";
import { emitEvent } from "@/lib/events";
import { CURRENCY_COOKIE } from "@/lib/currency";
import { isCurrency, formatDate } from "@/lib/utils";
import { assessCareer } from "@/lib/career/advisor";
import { ROLE_BY_ID, SKILL_BY_ID } from "@/lib/career/taxonomy";

const LIMITED = fail("Too many submissions from your network. Please try again later.");
const oneOf = <T extends readonly string[]>(values: T) => z.string().optional().transform((v) => (v && (values as readonly string[]).includes(v) ? v : null));

const enquirySchema = z.object({
  name: text(120, 2), email,
  country: oneOf(COUNTRIES), career_level: oneOf(CAREER_LEVELS), budget_range: oneOf(BUDGET_RANGES),
  current_skills: optionalText(500), target_role: optionalText(120), programme_interest: optionalText(120),
  message: optionalText(2000),
  kind: z.enum(["contact", "programme_enquiry", "consultation_request"]),
  consent: checkbox,
  website: z.string().max(0).optional(), // honeypot
});

export async function submitEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  if (typeof fd.get("website") === "string" && fd.get("website") !== "") return ok("Thank you. We will be in touch.");
  if (!(await rateLimitByIp("lead:enquiry", 8, 3600)).ok) return LIMITED;
  const p = parseForm(enquirySchema, fd);
  if (p.error) return p.error;
  const d = p.data;
  const source = d.kind === "contact" ? "contact_form" : d.kind;
  const lead = await captureLead({
    name: d.name, email: d.email, country: d.country, career_level: d.career_level, budget_range: d.budget_range, current_skills: d.current_skills,
    target_role: d.target_role, programme_interest: d.programme_interest, message: d.message, source, consent: d.consent,
    interaction: { type: d.kind === "consultation_request" ? "consultation_request" : "enquiry", summary: `${d.kind.replace(/_/g, " ")}${d.programme_interest ? ` — ${d.programme_interest}` : ""}`, details: { message: d.message, programme_interest: d.programme_interest } },
  });
  // Transactional confirmation of the visitor's own enquiry (not marketing).
  await sendEmail({ to: d.email, template: "enquiry_received", vars: { name: d.name.split(" ")[0], topic: d.programme_interest ?? "SkillXGen", unsubscribe_link: `${siteUrl()}/unsubscribe?token=${lead.unsubscribeToken}` } });
  return ok(d.kind === "consultation_request" ? "Thanks — your consultation request is in. We will email you within two working days to arrange a time." : "Thanks — we have your enquiry and will reply within two working days.");
}

const webinarSchema = z.object({ webinar_id: z.uuid(), name: text(120, 2), email, country: oneOf(COUNTRIES), consent: checkbox, website: z.string().max(0).optional() });

export async function registerForWebinar(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimitByIp("lead:webinar", 8, 3600)).ok) return LIMITED;
  const p = parseForm(webinarSchema, fd);
  if (p.error) return p.error;
  const d = p.data;
  const sql = service();
  const [webinar] = await sql`select id, title, starts_at, capacity, (select count(*)::int from registrations r where r.webinar_id = w.id and r.status <> 'cancelled') as taken
    from webinars w where id = ${d.webinar_id} and status = 'scheduled' and starts_at > now()`;
  if (!webinar) return fail("This webinar is no longer open for registration.");
  if (webinar.capacity != null && webinar.taken >= webinar.capacity) return fail("This webinar is full.");
  const viewer = await getViewer().catch(() => null);
  const lead = await captureLead({ name: d.name, email: d.email, country: d.country, source: "webinar", consent: d.consent,
    interaction: { type: "webinar_registration", summary: `Registered for webinar: ${webinar.title}`, details: { webinar_id: webinar.id } } });
  const inserted = await sql`insert into registrations (webinar_id, lead_id, user_id, name, email) values (${webinar.id}, ${lead.id}, ${viewer && viewer.email === d.email ? viewer.id : null}, ${d.name}, ${d.email})
    on conflict (webinar_id, email) do update set status = 'registered' returning (xmax = 0) as created`;
  if (inserted[0].created) {
    await sendEmail({ to: d.email, template: "webinar_registration", vars: { name: d.name.split(" ")[0], title: webinar.title, starts_at: formatDate(webinar.starts_at, true), unsubscribe_link: `${siteUrl()}/unsubscribe?token=${lead.unsubscribeToken}` } });
    emitEvent("webinar.registered", { webinar_id: webinar.id, lead_id: lead.id });
  }
  return ok(`You are registered for “${webinar.title}”. A confirmation email is on its way.`);
}

const resourceSchema = z.object({ resource: text(120), name: text(120, 2), email, consent: checkbox.refine((v) => v, "Tick the box so we can email you"), website: z.string().max(0).optional() });

export async function registerForResource(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimitByIp("lead:resource", 8, 3600)).ok) return LIMITED;
  const p = parseForm(resourceSchema, fd);
  if (p.error) return p.error;
  await captureLead({ name: p.data.name, email: p.data.email, source: "resource_download", consent: p.data.consent,
    interaction: { type: "resource_download", summary: `Subscribed to updates from resource: ${p.data.resource}`, details: { resource: p.data.resource } } });
  return ok("You are on the list. We send new free labs and guides occasionally — unsubscribe any time.");
}

const assessmentSchema = z.object({
  name: text(120, 2), email, country: oneOf(COUNTRIES),
  target_role: z.string().refine((v) => ROLE_BY_ID.has(v), "Choose a target role"),
  experience_level: z.enum(["none", "it-0-2", "it-3-plus", "security"]),
  hours_per_week: z.coerce.number().int().min(2).max(40),
  consent: checkbox, website: z.string().max(0).optional(),
});

export async function submitCareerAssessment(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!(await rateLimitByIp("lead:assessment", 8, 3600)).ok) return LIMITED;
  const p = parseForm(assessmentSchema, fd);
  if (p.error) return p.error;
  const d = p.data;
  const skills = fd.getAll("skills").filter((v): v is string => typeof v === "string" && SKILL_BY_ID.has(v)).slice(0, 60);
  const input = { targetRole: d.target_role, currentSkills: skills, heldCerts: [], experienceLevel: d.experience_level, hoursPerWeek: d.hours_per_week };
  const result = assessCareer(input);
  const lead = await captureLead({
    name: d.name, email: d.email, country: d.country, source: "career_assessment", consent: d.consent, target_role: result.role.title,
    current_skills: skills.map((s) => SKILL_BY_ID.get(s)!.label).join(", ").slice(0, 500) || null,
    interaction: { type: "assessment", summary: `Career assessment: ${result.role.title} — ${result.readiness.band}`, details: { readiness: result.readiness.score, core_missing: result.gap.coreMissing } },
  });
  await service()`insert into career_assessments (lead_id, target_role, input, result, engine) values (${lead.id}, ${d.target_role}, ${service().json(input as never)}, ${service().json(result as never)}, 'rules')`;
  return ok("Here is your skills gap summary.", { result });
}

export async function setCurrency(fd: FormData) {
  const value = fd.get("currency");
  if (isCurrency(value)) (await cookies()).set(CURRENCY_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
