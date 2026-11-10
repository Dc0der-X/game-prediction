import { extractCertIds, extractSkillIds, skillLabel, certLabel, SKILL_BY_ID } from "./taxonomy";
import type { ParsedJob } from "./jd";

export class ResumeParseError extends Error {}

/** Extracts plain text from a validated PDF or DOCX buffer. */
export async function extractText(buffer: Buffer, ext: string): Promise<string> {
  let text = "";
  try {
    if (ext === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const doc = await getDocumentProxy(new Uint8Array(buffer));
      const out = await pdfText(doc, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    }
  } catch {
    throw new ResumeParseError("We could not read that file. Export your resume again as a text-based PDF or DOCX and retry.");
  }
  text = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 150) throw new ResumeParseError("Very little text could be extracted. If your resume is a scanned image, export a text-based PDF or DOCX instead.");
  return text.slice(0, 60_000);
}

const SECTION_HEADINGS: Record<string, RegExp> = {
  summary: /^(professional\s+)?(summary|profile|objective|about( me)?)$/i,
  experience: /^(professional\s+|work\s+|relevant\s+)?(experience|employment( history)?|work history|career history)$/i,
  education: /^(education|academic background|qualifications)( (and|&) training)?$/i,
  skills: /^(technical\s+|core\s+|key\s+)?(skills|competencies|technologies|tools)( (and|&) (tools|technologies))?$/i,
  certifications: /^(certifications?|licen[cs]es( (and|&) certifications)?|credentials)$/i,
  projects: /^(projects|labs|home ?lab|portfolio|personal projects|security projects)( (and|&) labs)?$/i,
};

const ACTION_VERBS = new Set("analysed analyzed investigated triaged detected monitored responded contained escalated remediated built created designed developed implemented deployed configured automated led managed reduced improved increased documented wrote reported identified conducted performed tested hardened tuned resolved supported trained mentored delivered migrated maintained reviewed assessed audited hunted".split(" "));
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_RANGE = new RegExp(`(?:(${MONTH})\\s+)?((?:19|20)\\d{2})\\s*(?:-|–|—|to|until)\\s*(?:(?:(${MONTH})\\s+)?((?:19|20)\\d{2})|(present|current|now|ongoing))`, "gi");
const MONTH_INDEX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export type ParsedResume = {
  wordCount: number;
  contact: { email: boolean; phone: boolean; linkedin: boolean; github: boolean };
  sections: string[];
  skills: string[];
  certifications: string[];
  experience: { entries: { period: string; context: string }[]; years: number };
  education: string[];
  bullets: { total: number; actionLed: number; quantified: number };
  longLines: number;
};

export function parseResume(text: string, now = new Date()): ParsedResume {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = new Set<string>();
  for (const l of lines) {
    const cleaned = l.replace(/[:\-–—_|•]+$/g, "").trim();
    if (cleaned.length > 45) continue;
    for (const [key, re] of Object.entries(SECTION_HEADINGS)) if (re.test(cleaned)) sections.add(key);
  }

  const entries: { period: string; context: string }[] = [];
  const intervals: [number, number][] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(DATE_RANGE)) {
      const start = Number(m[2]) * 12 + (m[1] ? MONTH_INDEX[m[1].slice(0, 3).toLowerCase()] ?? 0 : 0);
      const end = m[5] ? now.getFullYear() * 12 + now.getMonth() : Number(m[4]) * 12 + (m[3] ? MONTH_INDEX[m[3].slice(0, 3).toLowerCase()] ?? 11 : 11);
      if (end < start || end - start > 12 * 50) continue;
      const rest = line.replace(m[0], "").replace(/[|,·•()\-–—]+/g, " ").trim();
      const context = (rest.length > 3 ? rest : lines[i - 1] ?? "").slice(0, 120);
      // Education date ranges are not work experience.
      if (/\b(university|college|school|b\.?sc|m\.?sc|bachelor|master|diploma|degree|gcse|a-levels?)\b/i.test(context + " " + (lines[i + 1] ?? ""))) continue;
      entries.push({ period: m[0], context });
      intervals.push([start, end]);
    }
  });
  intervals.sort((a, b) => a[0] - b[0]);
  let months = 0, cursor = -Infinity;
  for (const [a, b] of intervals) {
    const from = Math.max(a, cursor);
    if (b > from) months += b - from;
    cursor = Math.max(cursor, b);
  }

  const bulletLines = lines.filter((l) => /^[•▪◦●○■\-*–·]\s+\S/.test(l));
  const bulletText = bulletLines.map((l) => l.replace(/^[•▪◦●○■\-*–·]\s+/, ""));
  const education = lines.filter((l) => /\b(b\.?sc|m\.?sc|bachelor|master|ph\.?d|diploma|degree|university|college)\b/i.test(l) && l.length < 160).slice(0, 5);

  return {
    wordCount: text.split(/\s+/).filter(Boolean).length,
    contact: {
      email: /[\w.+-]+@[\w-]+\.[\w.-]+/.test(text),
      phone: /(?:\+?\d[\d\s().-]{8,}\d)/.test(text),
      linkedin: /linkedin\.com\/in\//i.test(text),
      github: /github\.com\//i.test(text),
    },
    sections: [...sections],
    skills: extractSkillIds(text),
    certifications: extractCertIds(text),
    experience: { entries: entries.slice(0, 12), years: Math.round((months / 12) * 10) / 10 },
    education,
    bullets: {
      total: bulletLines.length,
      actionLed: bulletText.filter((b) => ACTION_VERBS.has(b.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "")).length,
      quantified: bulletText.filter((b) => /\d/.test(b)).length,
    },
    longLines: lines.filter((l) => l.length > 220).length,
  };
}

export type Check = { id: string; category: "structure" | "content" | "skills"; label: string; status: "pass" | "warn" | "fail"; detail: string };
export type JobMatch = { coverage: number; matched: string[]; missing: string[]; preferredMissing: string[]; missingCerts: string[]; experienceGap: string | null };
export type ResumeAnalysis = {
  scores: { structure: number; content: number; skills: number; overall: number; jobMatch: number | null };
  checks: Check[];
  strengths: string[];
  improvements: string[];
  skillsByCategory: Record<string, string[]>;
  certifications: string[];
  experienceYears: number;
  jobMatch: JobMatch | null;
  disclaimer: string;
};

export const ANALYSIS_DISCLAIMER =
  "These indicators describe how clearly a resume is structured and how closely its wording overlaps with a job description. They are not an ATS score and do not predict screening or hiring decisions — employers and their systems differ.";

const score = (checks: Check[], category: Check["category"]) => {
  const own = checks.filter((c) => c.category === category);
  if (!own.length) return 0;
  return Math.round((own.reduce((n, c) => n + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0) / own.length) * 100);
};

export function matchJob(resume: Pick<ParsedResume, "skills" | "certifications" | "experience">, job: ParsedJob): JobMatch {
  const have = new Set(resume.skills);
  const matched = job.requiredSkills.filter((x) => have.has(x));
  const missing = job.requiredSkills.filter((x) => !have.has(x));
  const coverage = job.requiredSkills.length ? Math.round((matched.length / job.requiredSkills.length) * 100) : 0;
  return {
    coverage,
    matched: matched.map(skillLabel),
    missing: missing.map(skillLabel),
    preferredMissing: job.preferredSkills.filter((x) => !have.has(x)).map(skillLabel),
    missingCerts: job.certifications.filter((x) => !resume.certifications.includes(x)).map(certLabel),
    experienceGap: job.yearsRequired != null && resume.experience.years + 0.5 < job.yearsRequired
      ? `The posting asks for about ${job.yearsRequired}+ years; roughly ${resume.experience.years} years of dated experience was detected.` : null,
  };
}

export function analyzeResume(r: ParsedResume, job?: ParsedJob | null): ResumeAnalysis {
  const checks: Check[] = [];
  const add = (id: string, category: Check["category"], label: string, status: Check["status"], detail: string) => checks.push({ id, category, label, status, detail });
  const has = (sec: string) => r.sections.includes(sec);

  add("contact", "structure", "Contact details are machine-readable", r.contact.email && r.contact.phone ? "pass" : r.contact.email ? "warn" : "fail",
    r.contact.email && r.contact.phone ? "Email and phone number found in the text." : r.contact.email ? "Email found, but no phone number was detected." : "No email address could be read from the text. Avoid placing contact details in headers, footers or images.");
  add("linkedin", "structure", "LinkedIn profile linked", r.contact.linkedin ? "pass" : "warn", r.contact.linkedin ? "LinkedIn URL found." : "Add your LinkedIn profile URL; recruiters routinely check it.");
  const core = ["experience", "education", "skills"].filter((x) => !has(x));
  add("sections", "structure", "Standard section headings", core.length === 0 ? "pass" : core.length === 1 ? "warn" : "fail",
    core.length === 0 ? "Experience, Education and Skills headings were all recognised." : `Could not recognise a standard heading for: ${core.join(", ")}. Use conventional headings so parsers can find each section.`);
  add("summary", "structure", "Professional summary", has("summary") ? "pass" : "warn", has("summary") ? "Summary section present." : "Add a 3–4 line summary stating your target role, strongest evidence and key tools.");
  add("length", "structure", "Length", r.wordCount >= 300 && r.wordCount <= 900 ? "pass" : r.wordCount < 200 || r.wordCount > 1200 ? "fail" : "warn",
    `${r.wordCount} words. Early-career security resumes are usually clearest at one to two pages (about 350–800 words).`);
  add("layout", "structure", "Simple, single-column text flow", r.longLines === 0 && r.bullets.total >= 4 ? "pass" : r.bullets.total >= 4 ? "warn" : "fail",
    r.bullets.total < 4 ? "Few bullet points were detected. Tables, text boxes and multi-column layouts often extract badly — use plain bullet lists." : r.longLines ? "Some very long lines were found, which can indicate merged columns or dense paragraphs." : "Bullet lists extracted cleanly.");
  add("dates", "structure", "Dated experience", r.experience.entries.length ? "pass" : "warn",
    r.experience.entries.length ? `${r.experience.entries.length} dated entries found (about ${r.experience.years} years).` : "No date ranges were recognised. Write dates consistently, e.g. “Mar 2022 – Present”.");

  const actionRatio = r.bullets.total ? r.bullets.actionLed / r.bullets.total : 0;
  const quantRatio = r.bullets.total ? r.bullets.quantified / r.bullets.total : 0;
  add("action", "content", "Bullets start with action verbs", actionRatio >= 0.5 ? "pass" : actionRatio >= 0.25 ? "warn" : "fail",
    `${r.bullets.actionLed} of ${r.bullets.total} bullets begin with a strong verb (investigated, triaged, automated…).`);
  add("quantified", "content", "Evidence is quantified", quantRatio >= 0.3 ? "pass" : quantRatio >= 0.12 ? "warn" : "fail",
    `${r.bullets.quantified} of ${r.bullets.total} bullets include a number. Add volumes, time saved or scope where you can do so truthfully.`);
  add("projects", "content", "Hands-on projects or labs", has("projects") ? "pass" : "warn", has("projects") ? "Projects / labs section present." : "Add a Projects or Labs section — practical evidence matters most when you have little security experience.");
  add("certs", "content", "Certifications listed clearly", r.certifications.length ? "pass" : "warn",
    r.certifications.length ? `Recognised: ${r.certifications.map(certLabel).join(", ")}.` : "No recognised security certification found. If you are studying for one, list it as “in progress” with a target date.");

  const categories = new Set(r.skills.map((id) => SKILL_BY_ID.get(id)?.category));
  categories.delete("professional");
  add("skill-count", "skills", "Security skills named explicitly", r.skills.length >= 10 ? "pass" : r.skills.length >= 5 ? "warn" : "fail", `${r.skills.length} recognised security skills and tools.`);
  add("skill-breadth", "skills", "Breadth across domains", categories.size >= 4 ? "pass" : categories.size >= 2 ? "warn" : "fail", `Skills span ${categories.size} technical domains (detection, endpoint, network, systems, cloud, scripting, response…).`);
  const tooling = r.skills.filter((id) => ["splunk", "sentinel", "elastic", "qradar", "wazuh", "crowdstrike", "defender", "sentinelone", "wireshark", "nessus", "burp", "nmap"].includes(id));
  add("tools", "skills", "Named tools, not just concepts", tooling.length >= 3 ? "pass" : tooling.length >= 1 ? "warn" : "fail",
    tooling.length ? `Tools named: ${tooling.map(skillLabel).join(", ")}.` : "Name the specific tools you have used (for example a SIEM, an EDR, a packet analyser).");

  const jobMatch = job ? matchJob(r, job) : null;
  if (jobMatch) {
    add("jd-coverage", "skills", "Overlap with the job description", jobMatch.coverage >= 70 ? "pass" : jobMatch.coverage >= 40 ? "warn" : "fail",
      `${jobMatch.matched.length} of ${jobMatch.matched.length + jobMatch.missing.length} required skills from the posting appear in your resume.`);
  }

  const scores = { structure: score(checks, "structure"), content: score(checks, "content"), skills: score(checks, "skills"), overall: 0, jobMatch: jobMatch?.coverage ?? null };
  scores.overall = Math.round(scores.structure * 0.4 + scores.content * 0.3 + scores.skills * 0.3);

  const skillsByCategory: Record<string, string[]> = {};
  for (const id of r.skills) (skillsByCategory[SKILL_BY_ID.get(id)!.category] ??= []).push(skillLabel(id));

  const improvements = checks.filter((c) => c.status !== "pass").map((c) => c.detail);
  if (jobMatch?.missing.length) improvements.unshift(`Skills the posting requires that your resume does not mention: ${jobMatch.missing.join(", ")}. Only add ones you can genuinely evidence — otherwise treat them as learning goals.`);
  if (jobMatch?.missingCerts.length) improvements.push(`Certifications named in the posting that were not found: ${jobMatch.missingCerts.join(", ")}.`);
  if (jobMatch?.experienceGap) improvements.push(jobMatch.experienceGap);

  return {
    scores, checks,
    strengths: checks.filter((c) => c.status === "pass").map((c) => c.label),
    improvements,
    skillsByCategory,
    certifications: r.certifications.map(certLabel),
    experienceYears: r.experience.years,
    jobMatch,
    disclaimer: ANALYSIS_DISCLAIMER,
  };
}

export function analysisToMarkdown(a: ResumeAnalysis, ai: { summary?: string; rewrites?: { before: string; after: string; why: string }[] } | null, meta: { fileName: string; date: Date; jobTitle?: string | null }) {
  const lines = [
    `# Resume analysis report`, ``, `File: ${meta.fileName}  `, `Date: ${meta.date.toISOString().slice(0, 10)}${meta.jobTitle ? `  \nCompared with: ${meta.jobTitle}` : ""}`, ``,
    `> ${a.disclaimer}`, ``, `## Indicators`, ``,
    `| Area | Indicator |`, `|---|---|`, `| Structure & parseability | ${a.scores.structure}/100 |`, `| Content & evidence | ${a.scores.content}/100 |`, `| Skills coverage | ${a.scores.skills}/100 |`,
    ...(a.scores.jobMatch != null ? [`| Overlap with job description | ${a.scores.jobMatch}% |`] : []), ``,
    `## Checks`, ``, ...a.checks.map((c) => `- **${c.status.toUpperCase()}** — ${c.label}: ${c.detail}`), ``,
    `## Skills recognised`, ``, ...Object.entries(a.skillsByCategory).map(([k, v]) => `- **${k}**: ${v.join(", ")}`), ``,
  ];
  if (a.jobMatch) lines.push(`## Job description match`, ``, `- Matched: ${a.jobMatch.matched.join(", ") || "none"}`, `- Missing (required): ${a.jobMatch.missing.join(", ") || "none"}`, `- Missing (preferred): ${a.jobMatch.preferredMissing.join(", ") || "none"}`, ``);
  lines.push(`## Recommended improvements`, ``, ...a.improvements.map((i) => `- ${i}`), ``);
  if (ai?.summary) lines.push(`## AI review`, ``, ai.summary, ``);
  for (const r of ai?.rewrites ?? []) lines.push(`- **Before:** ${r.before}`, `  **After:** ${r.after}`, `  _${r.why}_`);
  return lines.join("\n");
}
