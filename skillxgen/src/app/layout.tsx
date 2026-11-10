import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { authProvider, config, siteUrl } from "@/lib/env";

const description = "SkillXGen is a cybersecurity training and career development company. Practical SOC analyst and penetration testing programmes, free labs, and honest career support for learners in the USA, UK and Canada.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "SkillXGen — Train. Build. Get Hired.", template: "%s · SkillXGen" },
  description,
  applicationName: "SkillXGen",
  openGraph: { type: "website", siteName: "SkillXGen", title: "SkillXGen — Train. Build. Get Hired.", description, url: "/" },
  twitter: { card: "summary_large_image", title: "SkillXGen — Train. Build. Get Hired.", description },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: "#08080a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the per-request CSP nonce also opts every route into dynamic rendering, which strict CSP requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const umamiScript = config.umamiScript(), umamiId = config.umamiWebsiteId();
  const body = (
    <body className="min-h-dvh bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-sm">Skip to content</a>
      {children}
      {umamiScript && umamiId ? <Script src={umamiScript} data-website-id={umamiId} strategy="afterInteractive" nonce={nonce} /> : null}
    </body>
  );
  return (
    <html lang="en">
      {authProvider() === "clerk" ? (
        <ClerkProvider dynamic nonce={nonce} appearance={{ variables: { colorPrimary: "#e5192b", colorBackground: "#131317", colorForeground: "#f5f5f6", colorInput: "#0f0f12", colorInputForeground: "#f5f5f6", colorMutedForeground: "#a3a3ad", colorNeutral: "#f5f5f6", borderRadius: "4px", fontFamily: "Space Grotesk Variable, system-ui, sans-serif" } }}>
          {body}
        </ClerkProvider>
      ) : body}
    </html>
  );
}
