import type { Metadata } from "next";
import { CheckList, CtaBand, Numbered, PageHero, Section, SectionHeading } from "@/components/site/sections";

export const metadata: Metadata = { title: "About SkillXGen", description: "Why SkillXGen exists, how we teach, and the standards we hold ourselves to.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <>
      <PageHero kicker="About SkillXGen" title="Security training that tells you the truth">
        SkillXGen is a cybersecurity education and career development company serving learners in the United States, the United Kingdom and Canada. We teach the practical work of defending and testing systems — and we are straightforward about what training can and cannot do for a career.
      </PageHero>
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading kicker="Why we exist" title="The industry needs people. Learners need honesty." />
            <div className="prose-sx mt-6">
              <p>Security teams are short of capable analysts and testers. At the same time, people trying to enter the field are sold certainty that nobody can deliver: guaranteed jobs, six-figure salaries in ninety days, testimonials no one can check.</p>
              <p>We think the way to earn trust is to be useful before asking for anything. So our introductory course, labs and guides are free; our programme pages list their own limitations; and we publish a student outcome only after verifying it and getting permission.</p>
              <p>If that means our Success Stories page is sparse for a while, so be it.</p>
            </div>
          </div>
          <div>
            <SectionHeading kicker="Our commitments" title="What you can hold us to" />
            <CheckList className="mt-6" items={[
              "We never guarantee employment, interviews, salaries or exam results.",
              "We never publish a testimonial, placement or statistic we have not verified.",
              "We label outcomes precisely: training completed, certification achieved, interview success or employment.",
              "We tell you when a programme is not the right fit — including when free material is enough.",
              "We teach offensive techniques only for authorised testing, under a code of conduct.",
              "We collect the minimum personal data we need and delete it on request.",
            ]} />
          </div>
        </div>
      </Section>
      <Section tone="surface">
        <SectionHeading kicker="How we teach" title="Method over tool lists" />
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <Numbered n={1} title="Evidence first">Every lab starts from logs, packets or an email — the same raw material you will see at work.</Numbered>
          <Numbered n={2} title="Write everything up">Investigation without documentation is a hobby. Each assignment ends in notes or a report.</Numbered>
          <Numbered n={3} title="Feedback from people">Instructors grade and comment on your work. AI tools help you practise between sessions; they do not replace review.</Numbered>
          <Numbered n={4} title="Career work in parallel">Resume, portfolio and interview practice run alongside the technical curriculum, not after it.</Numbered>
        </div>
      </Section>
      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <SectionHeading kicker="Instructors" title="Verified before published">
            We name instructors and list their experience and certifications only after checking them. Verified instructor credentials appear on each programme page and on our Success Stories page as they are confirmed.
          </SectionHeading>
          <SectionHeading kicker="Who we serve" title="USA · UK · Canada">
            Programmes are delivered online in English, scheduled for North American and UK time zones, and priced in US dollars, pounds sterling and Canadian dollars. Career guidance reflects hiring practice in those three markets.
          </SectionHeading>
        </div>
      </Section>
      <CtaBand title="Judge us by the free material" primary={{ href: "/academy", label: "Open the free academy" }} secondary={{ href: "/contact", label: "Ask us anything" }}>It is the fastest way to see how we teach.</CtaBand>
    </>
  );
}
