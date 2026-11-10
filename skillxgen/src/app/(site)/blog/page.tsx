import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState } from "@/components/ui/card";
import { ArrowLink, PageHero, Section } from "@/components/site/sections";

export const metadata: Metadata = { title: "Blog and Resources", description: "Practical articles on SOC work, phishing analysis, career change and interview preparation.", alternates: { canonical: "/blog" } };

export default async function BlogPage() {
  const posts = await withUser(await getViewer().catch(() => null), (sql) => sql`select slug, title, excerpt, tags, published_at, author_name from blog_posts where status = 'published' order by published_at desc limit 60`);
  return (
    <>
      <PageHero kicker="Blog and resources" title="Practical writing for people learning security">No hype, no fear. Short articles you can use.</PageHero>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_18rem]">
          <div>
            {posts.length ? (
              <div className="divide-y divide-border border-y border-border">
                {posts.map((p) => (
                  <article key={p.slug} className="py-8">
                    <p className="font-mono text-xs text-subtle">{formatDate(p.published_at)} · {p.author_name}</p>
                    <h2 className="mt-2 text-2xl font-semibold"><Link href={`/blog/${p.slug}`} className="hover:text-primary-hover">{p.title}</Link></h2>
                    <p className="mt-2 max-w-2xl text-muted">{p.excerpt}</p>
                    <div className="mt-4 flex flex-wrap gap-2">{(p.tags as string[]).map((t) => <Badge key={t}>{t}</Badge>)}</div>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No articles published yet" />}
          </div>
          <aside className="space-y-6">
            <div className="rounded-lg border border-border p-5"><p className="kicker">Free guides</p><p className="mt-3 text-sm text-muted">Career roadmap, resume checklist, interview question bank and a sample incident report.</p><ArrowLink href="/academy/resources" className="mt-4">Browse downloads</ArrowLink></div>
            <div className="rounded-lg border border-border p-5"><p className="kicker">Hands-on</p><p className="mt-3 text-sm text-muted">Four free browser labs: phishing, SIEM, incident reports and threat hunting.</p><ArrowLink href="/academy/soc-labs" className="mt-4">Open the labs</ArrowLink></div>
          </aside>
        </div>
      </Section>
    </>
  );
}
