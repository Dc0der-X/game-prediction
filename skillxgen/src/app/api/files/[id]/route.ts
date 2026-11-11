import { getViewer } from "@/lib/auth";
import { isUuid } from "@/lib/db";
import { readFileFor } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Private file download. RLS decides visibility: the owner, or staff entitled to that bucket.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const file = await readFileFor(viewer, id).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `attachment; filename="${file.name.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
