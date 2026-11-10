import type { Metadata } from "next";
import { ROLES, SKILLS } from "@/lib/career/taxonomy";
import { titleCase } from "@/lib/utils";
import { PageHero, Section } from "@/components/site/sections";
import { CareerAssessmentForm } from "@/components/site/lead-forms";

export const metadata: Metadata = { title: "Free career skills assessment", description: "A five-minute self-assessment that shows your skills gap for a target cybersecurity role.", alternates: { canonical: "/career-assessment" } };

export default function CareerAssessmentPage() {
  const groups = [...new Set(SKILLS.map((s) => s.category))].filter((c) => c !== "professional").map((category) => ({ category: titleCase(category), items: SKILLS.filter((s) => s.category === category).map((s) => ({ id: s.id, label: s.label })) }));
  return (
    <>
      <PageHero kicker="Free career assessment" title="Where are you against your target role?">Tick what you can already do, pick a role, and get a skills-gap summary with next steps. It takes about five minutes. This is a planning aid based on your own answers — not a prediction.</PageHero>
      <Section><div className="mx-auto max-w-4xl"><CareerAssessmentForm roles={ROLES.map((r) => ({ id: r.id, title: r.title }))} skills={groups} /></div></Section>
    </>
  );
}
