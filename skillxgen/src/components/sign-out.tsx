"use client";
import { SignOutButton } from "@clerk/nextjs";
import { logoutAction } from "@/app/(auth)/actions";

const cls = "rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-elevated hover:text-foreground cursor-pointer";

export function SignOut({ provider }: { provider: string }) {
  if (provider === "clerk") return <SignOutButton redirectUrl="/"><button className={cls}>Sign out</button></SignOutButton>;
  return <form action={logoutAction}><button className={cls} data-testid="sign-out">Sign out</button></form>;
}
