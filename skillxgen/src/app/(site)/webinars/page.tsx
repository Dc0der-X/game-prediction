import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/security";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/card";
import { PageHero, Section, SectionHeading } from "@/components/site/sections";
import { WebinarForm } from "@/components/site/lead-forms";

export const metadata: Metadata = { title: "Webinars and Events", description: "Free live sessions on SOC investigation and cybersecurity careers.", alternates: { canonical: "/webinars" } };

export default async function WebinarsPage() {
  const viewer = await getViewer().catch(() => null);
  const { upcoming, past, mine } = await withUser(viewer, async (sql) => ({
    upcoming: await sql`select id, slug, title, description, starts_at, duration_minutes, host_name from webinars where status = 'scheduled' and starts_at > now() order by starts_at`,
    past: await sql`select slug, title, starts_at, recording_url from webinars where status = 'completed' order by starts_at desc limit 12`,
    mine: viewer ? await sql`select r.webinar_id, l.join_url from registrations r left join webinar_links l on l.webinar_id = r.webinar_id where r.user_id = ${viewer.id} and r.status <> 'cancelled'` : [],
  }));
  const joined = new Map(mine.map((m) => [m.webinar_id, m.join_url as string | null]));
  return (
    <>
      <PageHero kicker="Webinars and events" title="Free live sessions">Watch real investigations, ask questions, and get straight answers about careers in security. Free to attend.</PageHero>
      <Section>
        <SectionHeading kicker="Upcoming" title="Register for a session" />
        <div className="mt-10 space-y-6">
          {upcoming.length ? upcoming.map((w) => (
            <Card key={w.id}><CardContent className="grid gap-8 p-7 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <Badge variant="primary">Free · online</Badge>
                <h2 className="mt-4 text-2xl font-semibold">{w.title}</h2>
                <p className="mt-2 font-mono text-sm text-muted">{formatDate(w.starts_at, true)} · {w.duration_minutes} min · hosted by {w.host_name}</p>
                <p className="mt-4 leading-relaxed text-muted">{w.description}</p>
              </div>
              <div>
                {joined.has(w.id) ? (
                  <div className="rounded-md border border-success/40 bg-success/10 p-4 text-sm text-success">
                    You are registered.{safeHttpUrl(joined.get(w.id)) ? <> <a className="underline" href={safeHttpUrl(joined.get(w.id))!} target="_blank" rel="noopener noreferrer">Join link</a></> : null}
                  </div>
                ) : <WebinarForm webinarId={w.id} />}
              </div>
            </CardContent></Card>
          )) : <EmptyState title="No sessions scheduled right now">New dates are announced by email to people who opt in on the free resources page.</EmptyState>}
        </div>
      </Section>
      {past.length ? (
        <Section tone="surface">
          <SectionHeading kicker="Past sessions" title="Recordings" />
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {past.map((w) => (
              <li key={w.slug} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <span>{w.title} <span className="font-mono text-xs text-subtle">· {formatDate(w.starts_at)}</span></span>
                {safeHttpUrl(w.recording_url) ? <a href={safeHttpUrl(w.recording_url)!} className="text-sm text-primary-hover hover:underline" target="_blank" rel="noopener noreferrer">Watch recording</a> : <span className="text-sm text-subtle">Recording not available</span>}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
