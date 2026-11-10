import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/portal", "/admin", "/api", "/checkout", "/sign-in", "/sign-up", "/unsubscribe"] }], sitemap: `${siteUrl()}/sitemap.xml` };
}
