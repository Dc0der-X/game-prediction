import { withUser } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return new Response("Not found", { status: 404 });
  const [r] = await withUser(null, (sql) => sql`select slug, body from resources where slug = ${slug} and status = 'published'`);
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(`${r.body}\n\n---\nSkillXGen — free resource. Share freely with attribution.\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="skillxgen-${r.slug}.md"`, "X-Content-Type-Options": "nosniff" },
  });
}
