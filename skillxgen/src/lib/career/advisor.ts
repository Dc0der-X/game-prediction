import { ROLE_BY_ID, CERTS, skillLabel, certLabel, extractSkillIds, type RoleProfile } from "./taxonomy";

export type AdvisorInput = {
  targetRole: string;
  currentSkills: string[];      // skill ids
  skillsText?: string;          // free text; skills are extracted from it too
  heldCerts: string[];          // cert ids
  experienceLevel: "none" | "it-0-2" | "it-3-plus" | "security";
  hoursPerWeek: number;
  goals?: string;
};

export type AdvisorResult = {
  role: { id: string; title: string; summary: string; programme: string };
  gap: { coreHave: string[]; coreMissing: string[]; desirableHave: string[]; desirableMissing: string[]; coreCoverage: number };
  readiness: { score: number; band: "Getting started" | "Building" | "Nearly ready" | "Interview ready"; explanation: string };
  roadmap: { title: string; weeks: number; focus: string[]; newSkills: string[]; status: "review" | "learn" }[];
  totalWeeks: number;
  projects: { title: string; description: string; covers: string[] }[];
  certifications: { label: string; why: string }[];
  nextSteps: string[];
  disclaimer: string;
};

export const ADVISOR_DISCLAIMER =
  "This is a planning aid based on your self-assessment, not a guarantee of employment. Hiring depends on the market, location, the employer and your interview performance.";

export function assessCareer(input: AdvisorInput): AdvisorResult {
  const role: RoleProfile = ROLE_BY_ID.get(input.targetRole) ?? ROLE_BY_ID.get("soc-analyst")!;
  const have = new Set([...input.currentSkills, ...extractSkillIds(input.skillsText ?? "")]);
  const coreHave = role.core.filter((x) => have.has(x));
  const coreMissing = role.core.filter((x) => !have.has(x));
  const desirableHave = role.desirable.filter((x) => have.has(x));
  const desirableMissing = role.desirable.filter((x) => !have.has(x));
  const coreCoverage = Math.round((coreHave.length / role.core.length) * 100);

  const relevantCert = input.heldCerts.some((id) => role.certs.includes(id));
  const experiencePoints = { none: 0, "it-0-2": 8, "it-3-plus": 14, security: 20 }[input.experienceLevel];
  const score = Math.min(100, Math.round(coreCoverage * 0.6 + (desirableHave.length / Math.max(1, role.desirable.length)) * 12 + (relevantCert ? 8 : 0) + experiencePoints));
  const band = score >= 80 ? "Interview ready" : score >= 60 ? "Nearly ready" : score >= 35 ? "Building" : "Getting started";

  // Study pace: phases are sized for ~10 focused hours a week; scale to the learner's availability.
  const pace = Math.min(2.5, Math.max(0.5, 10 / Math.max(2, input.hoursPerWeek)));
  const roadmap = role.phases.map((p) => {
    const newSkills = p.skills.filter((x) => !have.has(x));
    const status: "review" | "learn" = newSkills.length === 0 ? "review" : "learn";
    const weeks = Math.max(1, Math.round(p.weeks * pace * (status === "review" ? 0.35 : newSkills.length < p.skills.length ? 0.75 : 1)));
    return { title: p.title, weeks, focus: p.focus, newSkills: newSkills.map(skillLabel), status };
  });

  const missing = new Set([...coreMissing, ...desirableMissing]);
  const projects = [...role.projects]
    .sort((a, b) => b.skills.filter((x) => missing.has(x)).length - a.skills.filter((x) => missing.has(x)).length)
    .map((p) => ({ title: p.title, description: p.description, covers: p.skills.map(skillLabel) }));

  const certifications = role.certs.filter((id) => !input.heldCerts.includes(id)).slice(0, 3).map((id, i) => {
    const cert = CERTS.find((x) => x.id === id)!;
    return { label: certLabel(id), why: i === 0 ? `Most commonly requested ${cert.level}-level certification for ${role.title} postings — a sensible first target.` : `A ${cert.level}-level follow-on once you have hands-on practice.` };
  });

  const nextSteps = [
    coreMissing.length ? `Start with the core gaps: ${coreMissing.slice(0, 4).map(skillLabel).join(", ")}.` : "Your core skills are covered — focus on evidence: projects, write-ups and interview practice.",
    `Build “${projects[0].title}” and publish a short write-up; practical evidence outweighs course certificates.`,
    certifications[0] ? `Book a realistic date for ${certifications[0].label} and study towards it alongside the roadmap.` : "Keep your existing certifications current.",
    "Run your resume through the Resume Analyzer against a real job description, then practise with the Interview Coach.",
  ];

  return {
    role: { id: role.id, title: role.title, summary: role.summary, programme: role.programme },
    gap: { coreHave: coreHave.map(skillLabel), coreMissing: coreMissing.map(skillLabel), desirableHave: desirableHave.map(skillLabel), desirableMissing: desirableMissing.map(skillLabel), coreCoverage },
    readiness: {
      score, band,
      explanation: `You report ${coreHave.length} of ${role.core.length} core skills${relevantCert ? ", hold a relevant certification" : ""}${experiencePoints ? " and bring transferable experience" : ""}. The indicator weights core skills most heavily.`,
    },
    roadmap,
    totalWeeks: roadmap.reduce((n, p) => n + p.weeks, 0),
    projects, certifications, nextSteps,
    disclaimer: ADVISOR_DISCLAIMER,
  };
}
