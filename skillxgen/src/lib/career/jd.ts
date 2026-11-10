import { extractCertIds, extractSkillIds, skillLabel, SKILL_BY_ID } from "./taxonomy";

export type ParsedJob = {
  title: string;
  seniority: "entry" | "mid" | "senior" | "unspecified";
  yearsRequired: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  certifications: string[];
  responsibilities: string[];
  signals: string[];
  interviewPrep: string[];
};

const PREFERRED_MARKER = /^(preferred|nice[- ]to[- ]have|desirable|bonus|plus|advantageous|ideally)\b|\b(preferred|nice to have|desirable|a plus|advantageous|bonus points)\b\s*(qualifications|skills|experience)?\s*:?\s*$/i;
const REQUIRED_MARKER = /^(requirements|required|must[- ]have|essential|qualifications|what you('ll)? need|minimum qualifications|about you|skills and experience)\b/i;
const RESPONSIBILITY_MARKER = /^(responsibilities|what you('ll| will)? do|the role|key duties|duties|day[- ]to[- ]day|your role)\b/i;

const PREP: Record<string, string> = {
  detection: "Be ready to walk through how you triage an alert end to end: what you check first, how you decide true vs false positive, and when you escalate.",
  endpoint: "Prepare an example of investigating a suspicious process on an endpoint (parent/child processes, command line, persistence).",
  network: "Revise TCP/IP, DNS and common ports; expect to explain what normal and suspicious traffic look like.",
  systems: "Revise Windows authentication and key event IDs (4624, 4625, 4688, 4720) and basic Linux log locations.",
  cloud: "Prepare to discuss the shared responsibility model, identity misconfigurations and cloud audit logs.",
  scripting: "Have one concrete script or automation you wrote ready to describe: the problem, the approach and the result.",
  response: "Know an incident response lifecycle (preparation → detection → containment → eradication → recovery → lessons learned) with an example.",
  threat: "Be able to map an attack scenario to MITRE ATT&CK tactics and explain how threat intelligence changes your investigation.",
  vulnerability: "Explain how you prioritise vulnerabilities beyond the CVSS score (exposure, exploitability, asset criticality).",
  offensive: "Expect methodology questions: scoping, enumeration, exploitation, and how you write up a finding with remediation advice.",
  governance: "Prepare to explain a framework you know (ISO 27001 / NIST CSF) and how you would assess and treat a risk.",
  professional: "Prepare STAR stories about communicating a technical issue to a non-technical person and working under pressure.",
};

export function parseJobDescription(text: string, titleHint?: string): ParsedJob {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const title = (titleHint?.trim() || nonEmpty.find((l) => l.length < 90 && /analyst|engineer|tester|consultant|responder|hunter|specialist|officer|architect|manager|intern|associate/i.test(l)) || nonEmpty[0] || "Untitled role").slice(0, 120);

  let mode: "required" | "preferred" | "responsibilities" = "required";
  const required: string[] = [], preferred: string[] = [], responsibilities: string[] = [];
  for (const line of nonEmpty) {
    const bare = line.replace(/^[•▪◦●○■\-*–·\d.)\s]+/, "").replace(/[:：]\s*$/, "");
    if (bare.length < 60 && PREFERRED_MARKER.test(bare)) { mode = "preferred"; continue; }
    if (bare.length < 60 && REQUIRED_MARKER.test(bare)) { mode = "required"; continue; }
    if (bare.length < 60 && RESPONSIBILITY_MARKER.test(bare)) { mode = "responsibilities"; continue; }
    const inlinePreferred = /\b(preferred|nice to have|desirable|a plus|is a bonus|advantageous)\b/i.test(line);
    if (mode === "responsibilities") { if (bare.length > 15) responsibilities.push(bare.slice(0, 220)); required.push(line); }
    else if (mode === "preferred" || inlinePreferred) preferred.push(line);
    else required.push(line);
  }
  const requiredSkills = extractSkillIds(required.join("\n"));
  const preferredSkills = extractSkillIds(preferred.join("\n")).filter((x) => !requiredSkills.includes(x));

  const years = [...text.matchAll(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2}\s*)?\+?\s*years?/gi)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 20);
  const yearsRequired = years.length ? Math.min(...years) : null;
  const lower = text.toLowerCase();
  const seniority: ParsedJob["seniority"] =
    /\b(senior|lead|principal|staff|sr\.?)\b/.test(lower) ? "senior"
    : /\b(junior|entry[- ]level|graduate|associate|tier 1|level 1|l1|trainee|intern)\b/.test(lower) || (yearsRequired != null && yearsRequired <= 1) ? "entry"
    : yearsRequired != null && yearsRequired >= 3 ? "mid" : "unspecified";

  const signals: string[] = [];
  if (/\b(shift|24\s*[x/]\s*7|rota|night|weekend)\b/i.test(text)) signals.push("Shift or 24/7 rota work is mentioned.");
  if (/\bon[- ]call\b/i.test(text)) signals.push("On-call duty is mentioned.");
  if (/\b(security clearance|sc cleared|dv cleared|secret clearance|public trust|citizen(ship)?)\b/i.test(text)) signals.push("A clearance or citizenship requirement is mentioned — check your eligibility before applying.");
  if (/\bremote\b/i.test(text)) signals.push("Remote working is mentioned.");
  if (/\bhybrid\b/i.test(text)) signals.push("Hybrid working is mentioned.");
  if (/\b(degree|bachelor)\b/i.test(text)) signals.push(/\bor equivalent\b/i.test(text) ? "A degree or equivalent experience is requested." : "A degree is mentioned.");

  const categories = [...new Set([...requiredSkills, ...preferredSkills].map((id) => SKILL_BY_ID.get(id)!.category))];
  return {
    title, seniority, yearsRequired, requiredSkills, preferredSkills,
    certifications: extractCertIds(text),
    responsibilities: responsibilities.slice(0, 10),
    signals,
    interviewPrep: categories.map((cat) => PREP[cat]).filter(Boolean).slice(0, 6),
  };
}

export const describeJob = (j: ParsedJob) => ({
  ...j,
  requiredSkillLabels: j.requiredSkills.map(skillLabel),
  preferredSkillLabels: j.preferredSkills.map(skillLabel),
});
