import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { Markdown } from "@/components/markdown";
import { Container, CtaBand } from "@/components/site/sections";

type Props = { params: Promise<{ slug: string }> };
const load = async (slug: string) => (await withUser(await getViewer().catch(() => null), (sql) => sql`select * from blog_posts where slug = ${slug} and status = 'published'`))[0];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load((await params).slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt, alternates: { canonical: `/blog/${post.slug}` }, openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.published_at?.toISOString?.() } };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await load((await params).slug);
  if (!post) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt, datePublished: post.published_at, author: { "@type": "Organization", name: post.author_name }, publisher: { "@type": "Organization", name: "SkillXGen" }, mainEntityOfPage: `${siteUrl()}/blog/${post.slug}` };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="border-b border-border py-16 lg:py-20">
        <Container className="max-w-3xl">
          <Link href="/blog" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-foreground">← Blog</Link>
          <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-4 font-mono text-xs text-subtle">{formatDate(post.published_at)} · {post.author_name}</p>
          <p className="mt-6 text-xl leading-relaxed text-muted">{post.excerpt}</p>
          <Markdown className="mt-10">{post.body}</Markdown>
        </Container>
      </article>
      <CtaBand title="Practise what you just read" primary={{ href: "/academy/soc-labs", label: "Open the free SOC labs" }} secondary={{ href: "/courses", label: "See programmes" }}>Reading helps. Investigating helps more.</CtaBand>
    </>
  );
}
