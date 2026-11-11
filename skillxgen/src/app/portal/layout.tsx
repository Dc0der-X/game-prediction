import type { Metadata } from "next";
import { can, requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · SkillXGen" }, robots: { index: false, follow: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("/portal");
  const [{ unread }] = await withUser(viewer, (sql) => sql`select count(*)::int as unread from notifications where user_id = ${viewer.id} and read_at is null`);
  return (
    <AppShell viewer={viewer} area="Student portal" switchTo={can(viewer, "admin.access") ? { href: "/admin", label: "Administration" } : undefined} groups={[
      { title: "Learn", items: [{ href: "/portal", label: "Dashboard" }, { href: "/portal/learning", label: "My learning" }, { href: "/portal/assignments", label: "Assignments and projects" }, { href: "/academy/soc-labs", label: "SOC labs" }] },
      { title: "Career tools", items: [{ href: "/portal/tools/resume-analyzer", label: "Resume Analyzer" }, { href: "/portal/tools/jd-analyser", label: "Job Description Analyser" }, { href: "/portal/tools/career-advisor", label: "Career Advisor" }, { href: "/portal/tools/interview-coach", label: "Interview Coach" }, { href: "/portal/tools/learning-assistant", label: "Learning Assistant" }, { href: "/portal/roadmap", label: "Career roadmap" }] },
      { title: "Account", items: [{ href: "/portal/notifications", label: "Notifications", badge: unread || undefined }, { href: "/portal/support", label: "Support" }, { href: "/portal/payments", label: "Payments" }, { href: "/portal/profile", label: "Profile and privacy" }] },
    ]}>{children}</AppShell>
  );
}
