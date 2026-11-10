import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { listProgrammes } from "@/lib/catalogue";
import { config } from "@/lib/env";
import { safeHttpUrl } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero, Section } from "@/components/site/sections";
import { EnquiryForm } from "@/components/site/lead-forms";

export const metadata: Metadata = { title: "Contact", description: "Ask a question or book a free consultation with the SkillXGen team.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const programmes = await listProgrammes(await getViewer().catch(() => null));
  const cal = safeHttpUrl(config.calcomLink());
  return (
    <>
      <PageHero kicker="Contact" title="Talk to a person">Ask a question or request a 20-minute consultation. We reply within two working days, and we will tell you plainly if we are not the right choice.</PageHero>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold">Request a consultation</h2>
            <p className="mb-8 mt-2 text-muted">Tell us where you are and what you want to achieve.</p>
            <EnquiryForm kind="consultation_request" programmes={programmes.map((p) => p.title)} />
          </div>
          <div className="space-y-5">
            {cal ? (
              <Card><CardContent>
                <p className="kicker">Prefer to pick a time?</p>
                <p className="mt-3 text-sm text-muted">Book directly in our calendar.</p>
                <Button asChild className="mt-4" variant="outline"><a href={cal} target="_blank" rel="noopener noreferrer">Open booking calendar</a></Button>
              </CardContent></Card>
            ) : null}
            <Card><CardContent>
              <p className="kicker">What happens next</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>We read your message and reply by email.</li>
                <li>If a call would help, we agree a time.</li>
                <li>On the call we ask about your background and goals, and recommend a next step — which may be free.</li>
              </ol>
            </CardContent></Card>
            <Card><CardContent>
              <p className="kicker">Already a student?</p>
              <p className="mt-3 text-sm text-muted">Use the support area in your dashboard so your request is linked to your account.</p>
              <Button asChild className="mt-4" variant="outline" size="sm"><a href="/portal/support">Open support</a></Button>
            </CardContent></Card>
          </div>
        </div>
      </Section>
    </>
  );
}
