import { getViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer().catch(() => null);
  return (
    <>
      <SiteHeader viewer={viewer} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
