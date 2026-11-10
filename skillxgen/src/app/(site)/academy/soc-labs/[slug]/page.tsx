import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { LAB_BY_SLUG, publicQuestions } from "@/content/labs";
import { Badge } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { Container } from "@/components/site/sections";
import { LogBlock } from "@/components/site/visuals";
import { LabRunner, SiemExplorer } from "@/components/site/lab-runner";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lab = LAB_BY_SLUG.get((await params).slug);
  return lab ? { title: lab.title, description: lab.summary, alternates: { canonical: `/academy/soc-labs/${lab.slug}` } } : {};
}

export default async function LabPage({ params }: Props) {
  const lab = LAB_BY_SLUG.get((await params).slug);
  if (!lab) notFound();
  const viewer = await getViewer().catch(() => null);
  const [attempt] = viewer ? await withUser(viewer, (sql) => sql`select score, max_score from lab_attempts where user_id = ${viewer.id} and lab_slug = ${lab.slug}`) : [];
  return (
    <Container className="max-w-5xl py-12 lg:py-16">
      <Link href="/academy/soc-labs" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Free SOC labs</Link>
      <div className="mt-6 flex flex-wrap gap-2"><Badge variant="success">Free lab</Badge><Badge>{lab.level}</Badge><Badge>{lab.minutes} min</Badge></div>
      <h1 className="mt-4 text-4xl font-semibold leading-tight">{lab.title}</h1>
      <Markdown className="mt-6 max-w-3xl">{lab.briefing}</Markdown>
      <div className="mt-10 space-y-6">
        <h2 className="kicker">Evidence</h2>
        {lab.events ? <SiemExplorer events={lab.events} /> : null}
        {lab.evidence.map((e) => <LogBlock key={e.label} label={e.label} lines={e.lines} />)}
      </div>
      <div className="mt-12">
        <h2 className="kicker mb-6">Your analysis</h2>
        <LabRunner slug={lab.slug} questions={publicQuestions(lab)} next={lab.next} previousScore={attempt ? `${attempt.score}/${attempt.max_score}` : null} />
      </div>
    </Container>
  );
}
