import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { RoadmapView } from "@/components/portal/roadmap-view";

export const metadata = { title: "Career roadmap" };

export default async function RoadmapPage() {
  const viewer = await requireViewer("/portal/roadmap");
  const [latest] = await withUser(viewer, (sql) => sql`select result, created_at from career_assessments where user_id = ${viewer.id} order by created_at desc limit 1`);
  return (
    <>
      <PageTitle title="Career roadmap" actions={<Button asChild variant="outline" size="sm"><Link href="/portal/tools/career-advisor">{latest ? "Update assessment" : "Start assessment"}</Link></Button>}>
        {latest ? `Based on your assessment from ${formatDate(latest.created_at)}.` : "Your personal route to your target role."}
      </PageTitle>
      {latest ? <RoadmapView result={latest.result} /> : <EmptyState title="No roadmap yet">Complete the Career Advisor assessment to generate your roadmap. <Link href="/portal/tools/career-advisor" className="text-primary-hover underline">Start now</Link></EmptyState>}
    </>
  );
}
