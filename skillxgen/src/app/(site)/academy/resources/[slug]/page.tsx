import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { Container, CtaBand } from "@/components/site/sections";

type Props = { params: Promise<{ slug: string }> };
const load = async (slug: string) => (await withUser(await getViewer().catch(() => null), (sql) => sql`select * from resources where slug = ${slug} and status = 'published'`))[0];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug);
  return r ? { title: r.title, description: r.description, alternates: { canonical: `/academy/resources/${r.slug}` } } : {};
}

export default async function ResourcePage({ params }: Props) {
  const r = await load((await params).slug);
  if (!r) notFound();
  return (
    <>
      <Container className="max-w-3xl py-12 lg:py-16">
        <Link href="/academy/resources" className="no-print font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Free resources</Link>
        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-4">
          <Badge>{r.kind}</Badge>
          <Button asChild variant="outline" size="sm"><a href={`/academy/resources/${r.slug}/download`} data-testid="download-resource"><Download aria-hidden />Download (.md)</a></Button>
        </div>
        <Markdown className="print-surface mt-8">{r.body}</Markdown>
      </Container>
      <div className="no-print"><CtaBand title="Put it into practice" primary={{ href: "/academy/soc-labs", label: "Open the free labs" }} secondary={{ href: "/portal/tools", label: "Use the career tools" }}>Guides help; doing the work helps more.</CtaBand></div>
    </>
  );
}
