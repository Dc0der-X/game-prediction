import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { service } from "../db";
import { authProvider, localAuthSecret } from "../env";
import { SESSION_COOKIE, verifySession } from "./session";

export type Role = "super_admin" | "admin" | "instructor" | "student";
export type Viewer = { id: string; email: string; fullName: string; role: Role; permissions: string[] };

const PROFILE_FIELDS = `p.id, p.email, p.full_name, p.role, p.status,
  array(select rp.permission_key from role_permissions rp where rp.role_key = p.role) as permissions`;

function toViewer(row: Record<string, unknown> | undefined): Viewer | null {
  if (!row || row.status !== "active") return null;
  return { id: row.id as string, email: row.email as string, fullName: (row.full_name as string) || "", role: row.role as Role, permissions: row.permissions as string[] };
}

async function clerkViewer(): Promise<Viewer | null> {
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) return null;
  const sql = service();
  const [existing] = await sql.unsafe(`select ${PROFILE_FIELDS} from profiles p where p.auth_provider = 'clerk' and p.auth_user_id = $1`, [userId]);
  if (existing) return toViewer(existing);

  // First sign-in: provision the profile just-in-time (the Clerk webhook does the same asynchronously).
  const user = await currentUser();
  const primary = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  if (!user || !primary || primary.verification?.status !== "verified") return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const id = await provisionClerkProfile(userId, primary.emailAddress, fullName);
  if (!id) return null;
  const [row] = await sql.unsafe(`select ${PROFILE_FIELDS} from profiles p where p.id = $1`, [id]);
  return toViewer(row);
}

/** Creates the profile for a verified Clerk user, or links a profile pre-provisioned by `npm run admin:create`. */
export async function provisionClerkProfile(clerkUserId: string, email: string, fullName: string): Promise<string | null> {
  const sql = service();
  const [row] = await sql`
    insert into profiles (auth_provider, auth_user_id, email, full_name) values ('clerk', ${clerkUserId}, ${email.toLowerCase()}, ${fullName})
    on conflict (email) do update set auth_provider = 'clerk', auth_user_id = excluded.auth_user_id,
      full_name = case when profiles.full_name = '' then excluded.full_name else profiles.full_name end
    where profiles.auth_user_id like 'pending:%' or (profiles.auth_provider = 'clerk' and profiles.auth_user_id = excluded.auth_user_id)
    returning id`;
  if (!row) {
    console.error("Clerk user could not be linked: email already belongs to another identity", clerkUserId);
    return null;
  }
  await sql`update leads set profile_id = ${row.id} where email = ${email.toLowerCase()} and profile_id is null`;
  return row.id;
}

async function localViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, localAuthSecret());
  if (!session) return null;
  const [row] = await service().unsafe(
    `select ${PROFILE_FIELDS} from profiles p join local_auth_users l on l.profile_id = p.id
     where p.id = $1 and p.auth_provider = 'local' and l.email_verified_at is not null
       and l.sessions_valid_after <= to_timestamp($2::bigint + 5)`,
    [session.profileId, session.issuedAt]);
  return toViewer(row);
}

/** The authenticated user for this request (memoised per request), or null for guests. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const provider = authProvider();
  if (provider === "clerk") return clerkViewer();
  if (provider === "local") return localViewer();
  return null;
});

export const can = (viewer: Viewer | null | undefined, permission: string) => !!viewer?.permissions.includes(permission);

export async function requireViewer(returnTo?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in${returnTo ? `?redirect_url=${encodeURIComponent(returnTo)}` : ""}`);
  return viewer;
}

export async function requirePerm(permission: string, returnTo?: string): Promise<Viewer> {
  const viewer = await requireViewer(returnTo);
  if (!can(viewer, permission)) redirect("/forbidden");
  return viewer;
}

/** For server actions / route handlers: throws instead of redirecting. */
export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message); }
}
export async function assertPerm(permission: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError(401, "You need to sign in.");
  if (!can(viewer, permission)) throw new AuthError(403, "You do not have permission to do that.");
  return viewer;
}
export async function assertViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthError(401, "You need to sign in.");
  return viewer;
}
