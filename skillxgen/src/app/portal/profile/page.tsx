import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { authProvider } from "@/lib/env";
import { formatDate, titleCase } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { DataRequestForms, ProfileForm } from "@/components/portal/forms";

export const metadata = { title: "Profile and privacy" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/portal/profile");
  const { profile, requests } = await withUser(viewer, async (sql) => ({
    profile: (await sql`select full_name, email, headline, bio, target_role, linkedin_url, country, career_level, marketing_consent, created_at from profiles where id = ${viewer.id}`)[0],
    requests: await sql`select type, status, created_at, note from data_requests where user_id = ${viewer.id} order by created_at desc limit 10`,
  }));
  return (
    <>
      <PageTitle title="Profile and privacy">Your details are private to you and the SkillXGen staff who support you.</PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card><CardContent><p className="kicker mb-4">Personal profile</p><ProfileForm profile={profile as never} /></CardContent></Card>
        <div className="space-y-6">
          <Card><CardContent>
            <p className="kicker mb-3">Account</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-subtle">Email</dt><dd className="truncate">{profile.email}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Role</dt><dd>{titleCase(viewer.role)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Member since</dt><dd>{formatDate(profile.created_at)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-subtle">Sign-in</dt><dd>{authProvider() === "clerk" ? "Managed by Clerk" : "Email and password"}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-subtle">{authProvider() === "clerk" ? "Change your email, password or two-factor settings from the account menu." : "To change your password, sign out and use “Forgot your password?”."}</p>
          </CardContent></Card>
        </div>
      </div>
      <Card className="mt-6"><CardContent>
        <p className="kicker mb-2">Your data</p>
        <p className="mb-5 max-w-2xl text-sm text-muted">Download everything we hold about you, or ask us to delete your account. Deletion removes your profile, uploads, career-tool history and learning records; payment records are kept only as long as the law requires.</p>
        <Button asChild variant="outline" size="sm" className="mb-6"><a href="/api/me/export" data-testid="export-data">Download my data (JSON)</a></Button>
        <DataRequestForms />
        {requests.length ? <ul className="mt-6 space-y-2 border-t border-border pt-4 text-sm">{requests.map((r, i) => <li key={i} className="flex flex-wrap items-center gap-3"><Badge variant={r.status === "pending" ? "warning" : "success"}>{r.status}</Badge>{titleCase(r.type)} request · {formatDate(r.created_at)}{r.note ? <span className="text-muted">— {r.note}</span> : null}</li>)}</ul> : null}
      </CardContent></Card>
    </>
  );
}
