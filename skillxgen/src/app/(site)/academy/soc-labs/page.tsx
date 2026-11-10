import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { LABS } from "@/content/labs";
import { Badge } from "@/components/ui/card";
import { CtaBand, PageHero, Section } from "@/components/site/sections";

export const metadata: Metadata = { title: "Free SOC Labs", description: "Hands-on SOC investigations in your browser: phishing triage, SIEM log analysis, incident report review and threat hunting.", alternates: { canonical: "/academy/soc-labs" } };

export default async function LabsPage() {
  const viewer = await getViewer().catch(() => null);
  const attempts = viewer ? await withUser(viewer, (sql) => sql`select lab_slug, score, max_score from lab_attempts where user_id = ${viewer.id}`) : [];
  const done = new Map(attempts.map((a) => [a.lab_slug, `${a.score}/${a.max_score}`]));
  return (
    <>
      <PageHero kicker="Free SOC labs" title="Four investigations. Real evidence. No setup.">
        Each lab gives you logs, headers or process data and asks you to reach a verdict. Every answer is explained. Nothing to install and no account needed — sign in only if you want your scores saved.
      </PageHero>
      <Section>
        <ol className="grid gap-5 md:grid-cols-2">
          {LABS.map((l, i) => (
            <li key={l.slug}>
              <Link href={`/academy/soc-labs/${l.slug}`} className="group flex h-full flex-col rounded-lg border border-border bg-card p-7 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between"><span className="font-mono text-xs text-primary-hover">LAB {String(i + 1).padStart(2, "0")}</span>{done.has(l.slug) ? <Badge variant="success">Best {done.get(l.slug)}</Badge> : <Badge>{l.level}</Badge>}</div>
                <h2 className="mt-4 text-xl font-semibold group-hover:text-primary-hover">{l.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{l.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">{l.skills.map((s) => <Badge key={s}>{s}</Badge>)}<span className="ml-auto font-mono text-xs text-subtle">{l.minutes} min</span></div>
              </Link>
            </li>
          ))}
        </ol>
      </Section>
      <CtaBand title="Enjoyed the labs?" primary={{ href: "/programmes/soc-analyst", label: "See the SOC Analyst Programme" }} secondary={{ href: "/academy", label: "Back to the academy" }}>The programme has dozens more, with instructor feedback on your written investigations.</CtaBand>
    </>
  );
}
