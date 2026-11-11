"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertViewer } from "@/lib/auth";
import { isUuid, service, withUser } from "@/lib/db";
import { CAREER_LEVELS, COUNTRIES, checkbox, fail, ok, optionalText, parseForm, text, type ActionState } from "@/lib/forms";
import { audit } from "@/lib/audit";
import { rateLimit, safeHttpUrl } from "@/lib/security";
import { UploadError, validateUpload } from "@/lib/uploads";
import { storeFile } from "@/lib/storage";

const profileSchema = z.object({
  full_name: text(120, 2), headline: optionalText(160), bio: optionalText(1200), target_role: optionalText(120), linkedin_url: optionalText(300),
  country: z.string().optional().transform((v) => (v && (COUNTRIES as readonly string[]).includes(v) ? v : null)),
  career_level: z.string().optional().transform((v) => (v && (CAREER_LEVELS as readonly string[]).includes(v) ? v : null)),
  marketing_consent: checkbox,
});

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  const p = parseForm(profileSchema, fd);
  if (p.error) return p.error;
  const d = p.data;
  const linkedin = d.linkedin_url ? safeHttpUrl(d.linkedin_url) : null;
  if (d.linkedin_url && (!linkedin || !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(linkedin))) return fail("Please correct the highlighted fields.", { linkedin_url: ["Enter a full https://www.linkedin.com/… address"] });
  // Column-level grants mean only these fields can change, whatever is submitted.
  await withUser(viewer, (sql) => sql`update profiles set full_name = ${d.full_name}, headline = ${d.headline}, bio = ${d.bio}, target_role = ${d.target_role}, linkedin_url = ${linkedin},
    country = ${d.country}, career_level = ${d.career_level}, marketing_consent = ${d.marketing_consent} where id = ${viewer.id}`);
  if (!d.marketing_consent) await service()`update leads set consent_marketing = false, unsubscribed_at = coalesce(unsubscribed_at, now()) where profile_id = ${viewer.id} and consent_marketing`;
  await audit(viewer, "profile.updated", "profile", viewer.id);
  revalidatePath("/portal", "layout");
  return ok("Profile saved.");
}

export async function requestData(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  const type = fd.get("type") === "deletion" ? "deletion" : "export";
  if (type === "deletion" && fd.get("confirm") !== "DELETE") return fail("Type DELETE to confirm the deletion request.");
  const [open] = await withUser(viewer, (sql) => sql`select 1 from data_requests where user_id = ${viewer.id} and type = ${type} and status = 'pending'`);
  if (open) return fail("You already have a pending request of this type.");
  await withUser(viewer, (sql) => sql`insert into data_requests (user_id, email, type) values (${viewer.id}, ${viewer.email}, ${type})`);
  await audit(viewer, `data.${type}_requested`, "profile", viewer.id);
  revalidatePath("/portal/profile");
  return ok(type === "deletion" ? "Deletion request received. An administrator will action it and confirm by email, normally within 30 days." : "Export request logged. You can also download your data immediately below.");
}

const submissionSchema = z.object({ assignment_id: z.uuid(), content: text(20000, 20), link_url: optionalText(500) });

export async function submitAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await rateLimit(`submit:${viewer.id}`, 30, 3600)).ok) return fail("Too many submissions. Please try again later.");
  const p = parseForm(submissionSchema, fd);
  if (p.error) return p.error;
  const link = p.data.link_url ? safeHttpUrl(p.data.link_url) : null;
  if (p.data.link_url && !link) return fail("Please correct the highlighted fields.", { link_url: ["Enter a full http(s) link"] });
  let fileId: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    try { fileId = (await storeFile(viewer, "submissions", await validateUpload(file, "asset"))).id; }
    catch (e) { return fail(e instanceof UploadError ? e.message : "The file could not be saved."); }
  }
  try {
    // RLS: the assignment must be published and in a course the student can access; passed work cannot be overwritten.
    const rows = await withUser(viewer, (sql) => sql`
      insert into submissions (assignment_id, user_id, content, link_url, file_id) values (${p.data.assignment_id}, ${viewer.id}, ${p.data.content}, ${link}, ${fileId})
      on conflict (assignment_id, user_id) do update set content = excluded.content, link_url = excluded.link_url, file_id = coalesce(excluded.file_id, submissions.file_id), status = 'submitted', submitted_at = now()
      returning id`);
    if (!rows.length) return fail("This submission can no longer be changed.");
    await audit(viewer, "submission.submitted", "submission", rows[0].id);
  } catch {
    return fail("You cannot submit to this assignment. It may already be marked as passed, or you may not be enrolled.");
  }
  revalidatePath(`/portal/assignments/${p.data.assignment_id}`);
  return ok("Submitted. Your instructor will review it and you will be notified when feedback is ready.");
}

const ticketSchema = z.object({ subject: text(160, 4), category: z.enum(["general", "technical", "billing", "course", "career"]), body: text(5000, 10) });

export async function createTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  if (!(await rateLimit(`ticket:${viewer.id}`, 10, 3600)).ok) return fail("Too many requests. Please try again later.");
  const p = parseForm(ticketSchema, fd);
  if (p.error) return p.error;
  const id = await withUser(viewer, async (sql) => {
    const [t] = await sql`insert into support_tickets (user_id, subject, category) values (${viewer.id}, ${p.data.subject}, ${p.data.category}) returning id`;
    await sql`insert into ticket_messages (ticket_id, author_id, is_staff, body) values (${t.id}, ${viewer.id}, false, ${p.data.body})`;
    return t.id as string;
  });
  await audit(viewer, "ticket.created", "support_ticket", id);
  redirect(`/portal/support/${id}`);
}

export async function replyToTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  const p = parseForm(z.object({ ticket_id: z.uuid(), body: text(5000, 2) }), fd);
  if (p.error) return p.error;
  try {
    await withUser(viewer, (sql) => sql`insert into ticket_messages (ticket_id, author_id, is_staff, body) values (${p.data.ticket_id}, ${viewer.id}, false, ${p.data.body})`);
  } catch {
    return fail("This ticket is closed or not available.");
  }
  await service()`update support_tickets set status = 'open', updated_at = now() where id = ${p.data.ticket_id} and user_id = ${viewer.id} and status in ('pending', 'resolved')`;
  revalidatePath(`/portal/support/${p.data.ticket_id}`);
  return ok("Reply sent.");
}

export async function markNotificationsRead(_: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await assertViewer();
  const id = fd.get("id");
  await withUser(viewer, (sql) => (isUuid(id)
    ? sql`update notifications set read_at = now() where id = ${id} and read_at is null`
    : sql`update notifications set read_at = now() where user_id = ${viewer.id} and read_at is null`));
  revalidatePath("/portal", "layout");
  return ok();
}
