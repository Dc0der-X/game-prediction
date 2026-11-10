import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { authProvider } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";

// The proxy sets the Content-Security-Policy and gives guests a fast redirect. It is NOT the access control:
// every page, action and route handler checks identity and permissions itself (resource-based checks),
// and PostgreSQL RLS enforces data access regardless of what happens here.
const isProtected = (req: NextRequest) => /^\/(portal|admin|checkout)(\/|$)/.test(req.nextUrl.pathname);

const origin = (url: string | undefined) => {
  try { return url ? new URL(url).origin : null; } catch { return null; }
};
const umami = origin(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL);
const FRAME_SOURCES = ["https://cal.com", "https://app.cal.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com"];

const clerkHandler = clerkMiddleware(
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "connect-src": umami ? [umami] : [],
        "script-src": umami ? [umami] : [],
        "frame-src": FRAME_SOURCES,
        "form-action": ["'self'", "https://checkout.stripe.com"],
      },
    },
  },
);

function localHandler(req: NextRequest) {
  if (isProtected(req) && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const dev = process.env.NODE_ENV !== "production";
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}${umami ? ` ${umami}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}${umami ? ` ${umami}` : ""}`,
    `frame-src 'self' ${FRAME_SOURCES.join(" ")}`,
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  return authProvider() === "clerk" ? clerkHandler(req, event) : localHandler(req);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
