import type { Metadata } from "next";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/tabs";
import { CtaBand, PageHero, Section } from "@/components/site/sections";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions about SkillXGen programmes, payments, outcomes and the free academy.", alternates: { canonical: "/faq" } };

const FAQ: { group: string; items: [string, string][] }[] = [
  { group: "Outcomes and honesty", items: [
    ["Do you guarantee a job?", "No. No training provider can honestly guarantee employment, and we do not. We provide rigorous training, a portfolio, interview preparation and job-search coaching. Hiring decisions are made by employers."],
    ["Why are there so few testimonials on the site?", "We publish a student outcome only after verifying it and obtaining written permission, and we label exactly what it is: training completion, certification, interview success or employment. We would rather show nothing than something unverifiable."],
    ["How long does it take to get a first security role?", "It varies widely with your background, location and the market. Many career changers need six to eighteen months of steady part-time study and applications. Some start in an adjacent IT role first."],
  ] },
  { group: "Programmes", items: [
    ["Do I need a technical background?", "For the SOC Analyst Programme you need solid computer literacy. The Career Transition Programme includes a foundations block for people from non-IT backgrounds. The Penetration Testing Programme expects networking and Linux fundamentals."],
    ["How are programmes delivered?", "Live online sessions, recorded for catch-up, with self-paced labs and written instructor feedback on assignments. Sessions are scheduled for North American and UK time zones."],
    ["How much time do I need each week?", "Between six and twelve hours depending on the programme. Each programme page states the expected weekly commitment."],
    ["Do you provide certifications?", "You receive a certificate of completion, which is a record of training — not an industry certification. We include preparation for external certifications where stated, but exams are taken with, and paid to, the certifying body."],
    ["Is the penetration testing content legal to practise?", "You practise only in lab environments built for the purpose and sign a code of conduct. Using these techniques against systems without explicit authorisation is illegal and ends your enrolment."],
  ] },
  { group: "Free academy and AI tools", items: [
    ["What is free?", "The SOC Analyst Foundations course, four browser labs, the downloadable guides, the career assessment, webinars and a free account with the AI career tools."],
    ["Do I need an account for the free content?", "No. Create a free account only if you want to save progress or use the career tools."],
    ["Does the Resume Analyzer give me an ATS score?", "No. It reports indicators about structure, parseability and overlap with a job description. Applicant tracking systems and recruiters differ, and no tool can predict a screening or hiring decision."],
    ["Is my resume used to train AI?", "Your documents are stored privately in your account and used only to produce your analysis. If an AI provider is enabled, the extracted text is sent to that provider to generate feedback. You can delete your data at any time from your profile."],
  ] },
  { group: "Payments and refunds", items: [
    ["Which currencies do you accept?", "US dollars, pounds sterling and Canadian dollars. You are charged in the currency you select."],
    ["How do payments work?", "Payments are processed by Stripe. Your enrolment is activated when Stripe confirms the payment to us, which usually takes a few seconds."],
    ["Can I get a refund?", "Yes, within the terms of our Refund Policy. Please read it before enrolling."],
    ["Do you offer payment plans?", "Ask us on a consultation call. Any arrangement will be confirmed in writing before you pay."],
  ] },
  { group: "Privacy", items: [
    ["What do you do with my data?", "We use it to provide the service you asked for. Marketing email is sent only with your consent and every message has an unsubscribe link. See the Privacy Policy for detail."],
    ["How do I delete my account and data?", "Open your profile in the dashboard and submit a deletion request, or contact us. We confirm when it is complete."],
  ] },
];

export default function FaqPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.flatMap((g) => g.items).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero kicker="FAQ" title="Questions people ask us">Straight answers. If yours is not here, <Link href="/contact" className="text-primary-hover underline">ask us</Link>.</PageHero>
      <Section>
        <div className="mx-auto max-w-3xl space-y-12">
          {FAQ.map((g) => (
            <div key={g.group}>
              <h2 className="kicker mb-2">{g.group}</h2>
              <Accordion type="multiple">
                {g.items.map(([q, a]) => <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>)}
              </Accordion>
            </div>
          ))}
        </div>
      </Section>
      <CtaBand title="Still deciding?" primary={{ href: "/contact", label: "Book a consultation" }} secondary={{ href: "/academy", label: "Try the free academy" }}>Twenty minutes, no sales script.</CtaBand>
    </>
  );
}
