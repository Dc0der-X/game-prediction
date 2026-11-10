// Seeds catalogue content (idempotent). With --demo also adds clearly labelled demonstration data.
// Usage: tsx scripts/seed.ts [--demo]
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { PROGRAMMES } from "../db/seed/programmes";
import { BLOG_POSTS, COURSES, RESOURCES } from "../db/seed/learning";
import { hashPassword } from "../src/lib/auth/password";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

export async function seed(url: string, opts: { demo?: boolean; quiet?: boolean; demoPassword?: string } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {}, ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined });
  const log = (m: string) => !opts.quiet && console.log(m);
  const j = (v: unknown) => sql.json(v as never);
  try {
    const programmeIds: Record<string, string> = {};
    for (const p of PROGRAMMES) {
      const [row] = await sql`
        insert into programmes (slug, title, tagline, summary, overview, category, audience, prerequisites, curriculum, outcomes, projects, deliverables, limitations, duration, delivery_format, instructor_info, price_usd, price_gbp, price_cad, enquiry_only, status, position)
        values (${p.slug}, ${p.title}, ${p.tagline}, ${p.summary}, ${p.overview}, ${p.category}, ${j(p.audience)}, ${j(p.prerequisites)}, ${j(p.curriculum)}, ${j(p.outcomes)}, ${j(p.projects)}, ${j(p.deliverables)}, ${j(p.limitations)}, ${p.duration}, ${p.delivery_format}, ${p.instructor_info}, ${p.price_usd}, ${p.price_gbp}, ${p.price_cad}, ${p.enquiry_only}, 'published', ${p.position})
        on conflict (slug) do update set position = excluded.position returning id`;
      programmeIds[p.slug] = row.id;
    }
    // Career Transition includes the SOC curriculum.
    log(`programmes: ${PROGRAMMES.length}`);

    let position = 0;
    for (const c of COURSES) {
      const [existing] = await sql`select id from courses where slug = ${c.slug}`;
      if (existing) continue;
      const [course] = await sql`
        insert into courses (programme_id, slug, title, summary, description, level, category, is_free, est_hours, status, position)
        values (${c.programme ? programmeIds[c.programme] : null}, ${c.slug}, ${c.title}, ${c.summary}, ${c.description}, ${c.level}, ${c.category}, ${c.is_free}, ${c.est_hours}, 'published', ${position++}) returning id`;
      let mi = 0;
      for (const m of c.modules) {
        const [mod] = await sql`insert into modules (course_id, title, summary, position) values (${course.id}, ${m.title}, ${m.summary}, ${mi++}) returning id`;
        let li = 0;
        for (const l of m.lessons) {
          await sql`insert into lessons (course_id, module_id, slug, title, content, duration_minutes, is_preview, resources, position)
            values (${course.id}, ${mod.id}, ${l.slug}, ${l.title}, ${l.content}, ${l.minutes}, ${l.preview ?? false}, ${j(l.resources ?? [])}, ${li++})`;
        }
      }
      let ai = 0;
      for (const a of c.assignments) await sql`insert into assignments (course_id, title, instructions, kind, position) values (${course.id}, ${a.title}, ${a.instructions}, ${a.kind}, ${ai++})`;
    }
    log(`courses: ${COURSES.length}`);

    for (const b of BLOG_POSTS) {
      await sql`insert into blog_posts (slug, title, excerpt, body, tags, status, published_at) values (${b.slug}, ${b.title}, ${b.excerpt}, ${b.body}, ${b.tags}, 'published', now())
        on conflict (slug) do nothing`;
    }
    for (const r of RESOURCES) {
      await sql`insert into resources (slug, title, description, kind, body, position) values (${r.slug}, ${r.title}, ${r.description}, ${r.kind}, ${r.body}, ${r.position}) on conflict (slug) do nothing`;
    }
    const webinars = [
      { slug: "inside-a-soc-investigation", title: "Inside a SOC investigation: live alert walkthrough", days: 14, description: "Watch an analyst triage a suspicious sign-in from first alert to written verdict, then ask questions. Free, 60 minutes, beginner friendly." },
      { slug: "career-change-qa", title: "Career change into cybersecurity: honest Q&A", days: 28, description: "An open question-and-answer session on routes into security, what transfers from other careers, realistic timelines and how to evaluate training providers — including us." },
    ];
    for (const w of webinars) {
      const [row] = await sql`insert into webinars (slug, title, description, starts_at, duration_minutes) values (${w.slug}, ${w.title}, ${w.description}, date_trunc('day', now()) + make_interval(days => ${w.days}, hours => 18), 60)
        on conflict (slug) do nothing returning id`;
      if (row) await sql`insert into webinar_links (webinar_id, join_url) values (${row.id}, 'https://example.com/webinar-link-to-be-configured')`;
    }
    log("blog, resources, webinars: ok");

    if (opts.demo) {
      if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demonstration data in production.");
      const password = opts.demoPassword ?? process.env.SEED_DEMO_PASSWORD ?? randomBytes(9).toString("base64url") + "7a";
      const hash = await hashPassword(password);
      const users: Record<string, string> = {};
      for (const u of [
        { email: "admin.demo@example.com", name: "Alex Morgan (Demo Admin)", role: "super_admin" },
        { email: "instructor.demo@example.com", name: "Priya Shah (Demo Instructor)", role: "instructor" },
        { email: "student.demo@example.com", name: "Jordan Lee (Demo Student)", role: "student" },
      ]) {
        const [p] = await sql`insert into profiles (auth_provider, auth_user_id, email, full_name, role, country) values ('local', ${"demo:" + u.email}, ${u.email}, ${u.name}, ${u.role}, 'United Kingdom')
          on conflict (email) do update set role = excluded.role returning id`;
        await sql`insert into local_auth_users (profile_id, password_hash, email_verified_at) values (${p.id}, ${hash}, now())
          on conflict (profile_id) do update set password_hash = excluded.password_hash, email_verified_at = now(), sessions_valid_after = now() - interval '1 minute'`;
        users[u.role] = p.id;
      }
      await sql`update courses set instructor_id = ${users.instructor} where slug in ('soc-analyst-core', 'security-plus-prep') and instructor_id is null`;
      await sql`insert into enrolments (user_id, programme_id, source) values (${users.student}, ${programmeIds["soc-analyst"]}, 'admin') on conflict do nothing`;

      const leads = [
        ["Sam Rivera (Demo)", "sam.rivera.demo@example.com", "United States", "Career changer (non-IT)", "SOC Analyst Programme", "new", "programme_enquiry"],
        ["Aisha Khan (Demo)", "aisha.khan.demo@example.com", "United Kingdom", "IT professional (0-2 years)", "Penetration Testing Programme", "contacted", "contact_form"],
        ["Liam O'Connor (Demo)", "liam.oconnor.demo@example.com", "Canada", "Student / no experience", "Career Transition Programme", "qualified", "career_assessment"],
        ["Mei Tanaka (Demo)", "mei.tanaka.demo@example.com", "United States", "IT professional (3+ years)", "AI in Cybersecurity", "consultation_booked", "webinar"],
        ["Dev Patel (Demo)", "dev.patel.demo@example.com", "United Kingdom", "Working in security", "Interview Preparation", "lost", "resource_download"],
      ];
      for (const [name, email, country, level, interest, stage, source] of leads) {
        const [l] = await sql`insert into leads (name, email, country, career_level, programme_interest, stage, source, consent_marketing, consent_at, consent_text, lost_reason, message)
          values (${name}, ${email}, ${country}, ${level}, ${interest}, ${stage}, ${source}, true, now(), 'Demonstration record', ${stage === "lost" ? "Chose to self-study (demo)" : null}, 'Demonstration enquiry — not a real person.')
          on conflict (email) do nothing returning id`;
        if (l) await sql`insert into lead_interactions (lead_id, type, summary) values (${l.id}, 'enquiry', 'Demonstration enquiry created by the seed script')`;
      }
      await sql`insert into testimonials (person_name, person_title, quote, outcome_type, consent_status, verification_status, published, is_demo)
        select 'Demo Learner', 'Demonstration record', 'DEMONSTRATION ONLY — this placeholder shows how a testimonial appears in the admin area. It is not a real statement and cannot be published.', 'training_completion', 'pending', 'unverified', false, true
        where not exists (select 1 from testimonials where is_demo)`;
      await sql`insert into coupons (code, description, percent_off, max_redemptions) values ('DEMO10', 'Demonstration coupon — 10% off', 10, 100) on conflict (code) do nothing`;
      const [camp] = await sql`insert into campaigns (name, objective, audience, status, owner_id) select 'Free SOC labs launch (Demo)', 'Drive sign-ups to the free SOC labs', 'Career changers in the UK, USA and Canada', 'active', ${users.super_admin}
        where not exists (select 1 from campaigns where name like '%(Demo)') returning id`;
      if (camp) {
        await sql`insert into content_assets (campaign_id, kind, title, body, status, author_id) values
          (${camp.id}, 'linkedin', 'Read a phishing URL right to left (Demo draft)', 'Most people read URLs left to right. Attackers count on it.\n\nRead from the first slash, right to left: the last two labels are the real domain.\n\nTry it on a full example in our free phishing lab.', 'in_review', ${users.super_admin}),
          (${camp.id}, 'idea', 'Short video: what a SOC analyst does in the first ten minutes of a shift (Demo idea)', '', 'idea', ${users.super_admin}),
          (${camp.id}, 'reddit', 'Educational write-up: brute force vs password spraying in logs (Demo draft)', 'A plain-language explanation with a log sample. No links required; mention the free lab only if asked.', 'draft', ${users.super_admin})`;
      }
      log(`demo data: ok\n\nDemo accounts (local auth adapter only):\n  admin.demo@example.com / instructor.demo@example.com / student.demo@example.com\n  password: ${password}\n`);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
  seed(url, { demo: process.argv.includes("--demo") }).catch((e) => { console.error(e.message ?? e); process.exit(1); });
}
