import { getViewer } from "@/lib/auth";
import { isUuid, withUser } from "@/lib/db";
import { analysisToMarkdown } from "@/lib/career/resume";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [row] = await withUser(viewer, (sql) => sql`select result, created_at from resume_analyses where id = ${id}`);
  if (!row) return new Response("Not found", { status: 404 });
  const md = analysisToMarkdown(row.result.analysis, row.result.ai, { fileName: row.result.fileName, date: row.created_at, jobTitle: row.result.jobTitle });
  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="resume-analysis-${id.slice(0, 8)}.md"`, "Cache-Control": "private, no-store" } });
}
