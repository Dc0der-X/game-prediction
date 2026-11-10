import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { withUser } from "@/lib/db";
import { LABS } from "@/content/labs";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed = ["", "/about", "/courses", "/pricing", "/academy", "/academy/soc-labs", "/academy/resources", "/success-stories", "/blog", "/webinars", "/contact", "/faq", "/career-assessment", "/privacy", "/terms", "/refund-policy"];
  const dynamicUrls = await withUser(null, async (sql) => [
    ...(await sql`select slug, updated_at from programmes where status = 'published'`).map((r) => ({ url: `/programmes/${r.slug}`, lastModified: r.updated_at })),
    ...(await sql`select slug, updated_at from blog_posts where status = 'published'`).map((r) => ({ url: `/blog/${r.slug}`, lastModified: r.updated_at })),
    ...(await sql`select slug from courses where status = 'published'`).map((r) => ({ url: `/academy/courses/${r.slug}`, lastModified: undefined })),
    ...(await sql`select slug from resources where status = 'published'`).map((r) => ({ url: `/academy/resources/${r.slug}`, lastModified: undefined })),
  ]).catch(() => []);
  return [
    ...fixed.map((p) => ({ url: base + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...LABS.map((l) => ({ url: `${base}/academy/soc-labs/${l.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...dynamicUrls.map((d) => ({ url: base + d.url, lastModified: d.lastModified, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
