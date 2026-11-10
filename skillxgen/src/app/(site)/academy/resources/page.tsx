import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { Badge } from "@/components/ui/card";
import { PageHero, Section, SectionHeading } from "@/components/site/sections";
import { ResourceUpdatesForm } from "@/components/site/lead-forms";

export const metadata: Metadata = { title: "Free guides and downloads", description: "Cybersecurity career roadmap, resume checklist, interview question bank, sample incident report and SIEM cheat sheet.", alternates: { canonical: "/academy/resources" } };

export default async function ResourcesPage() {
  const resources = await withUser(await getViewer().catch(() => null), (sql) => sql`select slug, title, description, kind from resources where status = 'published' order by position`);
  return (
    <>
      <PageHero kicker="Free resources" title="Guides you can read, download and reuse">No sign-up wall. Read online or download a copy.</PageHero>
      <Section>
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((r) => (
            <Link key={r.slug} href={`/academy/resources/${r.slug}`} className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-border-strong">
              <Badge>{r.kind}</Badge>
              <h2 className="mt-3 text-lg font-semibold group-hover:text-primary-hover">{r.title}</h2>
              <p className="mt-1.5 text-sm text-muted">{r.description}</p>
            </Link>
          ))}
        </div>
      </Section>
      <Section tone="surface">
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionHeading kicker="Optional" title="Get new resources by email">We add labs and guides regularly. Opt in if you would like to hear about them — unsubscribe with one click.</SectionHeading>
          <ResourceUpdatesForm resource="Free resources updates" />
        </div>
      </Section>
    </>
  );
}
