import { skillLabel, ROLE_BY_ID } from "./taxonomy";
import type { ParsedResume } from "./resume";
import type { ParsedJob } from "./jd";

export type InterviewMode = "technical" | "behavioural" | "mixed";
export type KeyPoint = { label: string; keywords: string[] };
export type BankQuestion = {
  id: string; category: "technical" | "behavioural" | "scenario"; roles: string[]; skill?: string;
  question: string; structure: string[]; keyPoints: KeyPoint[]; followUps: string[];
};

const STAR = ["Situation — set the context in one or two sentences", "Task — what you personally were responsible for", "Action — the specific steps you took and why", "Result — the outcome, ideally measured, and what you learned"];
const kp = (label: string, ...keywords: string[]): KeyPoint => ({ label, keywords });

// Question bank authored for SkillXGen. Sequencing follows common interview practice:
// warm-up → fundamentals → scenario deep-dive → behavioural → close.
export const QUESTION_BANK: BankQuestion[] = [
  { id: "t-triage", category: "technical", roles: ["soc-analyst", "incident-responder", "threat-hunter"], skill: "alert-triage",
    question: "A SIEM alert fires for multiple failed logins followed by a success on a single account. Walk me through how you would triage it.",
    structure: ["State what the alert means and your initial hypothesis", "List the evidence you would gather, in order", "Explain how you decide true vs false positive", "Say what you would do next: contain, escalate or close, and what you document"],
    keyPoints: [kp("Checks source IP / geolocation / reputation", "source ip", "ip address", "geolocation", "reputation", "location"), kp("Reviews authentication logs and event IDs", "4625", "4624", "authentication log", "event id", "sign-in log"), kp("Establishes whether activity is normal for the user", "baseline", "normal", "usual", "typical", "contact the user", "user behaviour"), kp("Looks at post-login activity", "after the login", "post-login", "subsequent", "following the success", "lateral", "mailbox rule"), kp("Contains or escalates", "reset", "disable", "escalate", "contain", "revoke", "mfa"), kp("Documents the investigation", "document", "ticket", "notes", "timeline")],
    followUps: ["What would make you conclude this is a false positive?", "The successful login came from a country the user has never logged in from. What changes?"] },
  { id: "t-tcp", category: "technical", roles: ["soc-analyst", "penetration-tester", "cloud-security", "incident-responder"], skill: "tcpip",
    question: "Explain what happens, at the network level, when a user types a URL into a browser and presses Enter. Where could a defender observe each step?",
    structure: ["Go step by step: resolution, connection, encryption, request", "Name the protocol at each step", "Tie each step to a log source or control"],
    keyPoints: [kp("DNS resolution", "dns"), kp("TCP three-way handshake", "handshake", "syn", "tcp"), kp("TLS negotiation", "tls", "ssl", "certificate", "https"), kp("HTTP request/response", "http", "get request", "response"), kp("Where defenders see it", "proxy", "firewall", "dns log", "netflow", "edr", "zeek")],
    followUps: ["Which of those steps can still be inspected when the traffic is encrypted?", "How could an attacker abuse DNS, and how would you spot it?"] },
  { id: "t-phish", category: "technical", roles: ["soc-analyst", "incident-responder"], skill: "phishing",
    question: "A user reports a suspicious email with a link. How do you analyse it safely and decide what to do?",
    structure: ["Safe handling first", "Header analysis", "Link / attachment analysis", "Scope: who else received it and who clicked", "Response and user communication"],
    keyPoints: [kp("Analyses headers and authentication results", "header", "spf", "dkim", "dmarc", "return-path", "reply-to"), kp("Inspects the URL without visiting it directly", "sandbox", "defang", "urlscan", "virustotal", "isolated"), kp("Checks the scope", "other recipients", "who else", "search the mailbox", "message trace", "clicked"), kp("Contains", "block", "purge", "quarantine", "reset", "remove the email"), kp("Communicates and documents", "inform", "user awareness", "document", "report")],
    followUps: ["SPF passes but you still think it is malicious. How is that possible?", "Three users clicked and one entered credentials. What are your next actions?"] },
  { id: "t-mitre", category: "technical", roles: ["soc-analyst", "threat-hunter", "incident-responder"], skill: "mitre",
    question: "What is MITRE ATT&CK and how have you used it — or how would you use it — in day-to-day analysis?",
    structure: ["Define it in one sentence", "Explain tactics vs techniques", "Give a concrete use: mapping an alert, coverage review or hunt"],
    keyPoints: [kp("Knowledge base of adversary behaviour", "knowledge base", "adversary", "behaviour", "behavior", "real-world"), kp("Tactics vs techniques", "tactic", "technique"), kp("Practical use", "map", "coverage", "gap", "hunt", "detection"), kp("Gives a specific example", "t1059", "t1566", "t1110", "t1078", "powershell", "phishing", "brute force", "valid accounts")],
    followUps: ["Pick one technique and tell me what telemetry you would need to detect it."] },
  { id: "t-windows", category: "technical", roles: ["soc-analyst", "incident-responder", "threat-hunter"], skill: "log-analysis",
    question: "Which Windows event IDs do you rely on most during an investigation, and what does each tell you?",
    structure: ["Group them: authentication, process, account changes", "Give the ID and its meaning", "Say how you would combine them in a timeline"],
    keyPoints: [kp("Logon success/failure", "4624", "4625"), kp("Process creation", "4688", "sysmon", "event id 1"), kp("Account or group changes", "4720", "4728", "4732", "4738"), kp("Privilege use / special logon", "4672", "4648"), kp("Logon types", "logon type", "type 3", "type 10", "rdp", "network logon")],
    followUps: ["How does Sysmon improve on native process logging?"] },
  { id: "t-ir", category: "technical", roles: ["incident-responder", "soc-analyst", "cloud-security"], skill: "incident-response",
    question: "Describe the phases of incident response and what you personally would do in each during a confirmed malware infection on one workstation.",
    structure: ["Name the lifecycle you are using", "For each phase give one or two concrete actions", "Close with lessons learned"],
    keyPoints: [kp("Preparation / detection & analysis", "preparation", "detection", "analysis", "identification"), kp("Containment", "contain", "isolate", "quarantine", "network isolation"), kp("Eradication", "eradicat", "remove", "reimage", "clean"), kp("Recovery", "recover", "restore", "monitor"), kp("Lessons learned", "lessons learned", "post-incident", "review", "improve"), kp("Evidence preservation", "evidence", "memory", "image", "chain of custody", "preserve")],
    followUps: ["When would you NOT immediately isolate the host?", "How do you check whether other machines are affected?"] },
  { id: "t-siem", category: "technical", roles: ["soc-analyst", "threat-hunter", "cloud-security"], skill: "siem",
    question: "How would you write a detection for password spraying in a SIEM? Describe the logic rather than exact syntax.",
    structure: ["Define the behaviour and how it differs from brute force", "Data source and fields", "Aggregation logic and threshold", "Tuning and false positives"],
    keyPoints: [kp("One source, many accounts", "many accounts", "multiple accounts", "distinct user", "different user"), kp("Failed authentication data source", "4625", "failed logon", "sign-in log", "authentication"), kp("Time window and threshold", "time window", "threshold", "within", "minutes", "count"), kp("Tuning", "false positive", "tune", "exclude", "allowlist", "whitelist", "service account")],
    followUps: ["How would the attacker try to stay under your threshold, and how would you adapt?"] },
  { id: "t-hunt", category: "scenario", roles: ["threat-hunter", "incident-responder", "soc-analyst"], skill: "threat-hunting",
    question: "You suspect an attacker is using encoded PowerShell for execution. How would you hunt for it across the estate?",
    structure: ["State a testable hypothesis", "Data sources", "Search logic", "How you separate benign from malicious", "What you do with the findings"],
    keyPoints: [kp("Process command-line telemetry", "command line", "4688", "sysmon", "edr", "script block", "4104"), kp("Looks for encoding flags", "-enc", "encodedcommand", "base64", "frombase64string"), kp("Context: parent process and user", "parent", "office", "winword", "spawned", "user context"), kp("Decodes and baselines", "decode", "baseline", "frequency", "rare", "stack"), kp("Turns the hunt into a detection", "detection", "rule", "alert", "document")],
    followUps: ["What legitimate software commonly uses encoded PowerShell in your experience?"] },
  { id: "t-pentest-method", category: "technical", roles: ["penetration-tester"], skill: "pentest",
    question: "Walk me through your methodology for an external network penetration test, from the first email to the final report.",
    structure: ["Scoping and authorisation", "Reconnaissance and enumeration", "Vulnerability identification and exploitation", "Post-exploitation within scope", "Reporting and retest"],
    keyPoints: [kp("Scope and written authorisation", "scope", "rules of engagement", "authoris", "authoriz", "permission", "contract"), kp("Recon and enumeration", "recon", "enumerat", "nmap", "osint", "port scan"), kp("Validates vulnerabilities safely", "exploit", "validate", "proof of concept", "false positive"), kp("Reporting with risk and remediation", "report", "remediation", "cvss", "risk rating", "executive summary"), kp("Communicates critical findings early", "immediately", "critical finding", "notify", "communicat")],
    followUps: ["You find a critical vulnerability on day one. What do you do?", "How do you avoid causing an outage?"] },
  { id: "t-owasp", category: "technical", roles: ["penetration-tester"], skill: "owasp",
    question: "Explain the difference between stored, reflected and DOM-based cross-site scripting, and how each is fixed.",
    structure: ["Define each in one sentence", "Give where the payload lives", "Remediation"],
    keyPoints: [kp("Stored XSS persists server-side", "stored", "persist", "database"), kp("Reflected XSS comes from the request", "reflected", "request", "parameter"), kp("DOM-based happens client-side", "dom", "client-side", "javascript"), kp("Output encoding and CSP", "encod", "escap", "content security policy", "csp", "sanitis", "sanitiz")],
    followUps: ["How would you demonstrate impact to a non-technical stakeholder?"] },
  { id: "t-privesc", category: "scenario", roles: ["penetration-tester"], skill: "privilege-escalation",
    question: "You have a low-privileged shell on a Linux server in a lab. What do you check to escalate privileges?",
    structure: ["Situational awareness", "Common misconfiguration classes", "How you would verify and document"],
    keyPoints: [kp("Sudo rights", "sudo -l", "sudo"), kp("SUID binaries / capabilities", "suid", "capabilit"), kp("Scheduled tasks and writable paths", "cron", "writable", "path"), kp("Kernel and software versions", "kernel", "version", "uname"), kp("Credentials in files or history", "password", "credential", "history", "config file")],
    followUps: ["Which of those would you avoid on a production system and why?"] },
  { id: "t-risk", category: "technical", roles: ["grc-analyst", "cloud-security"], skill: "risk",
    question: "How would you assess and treat a risk that a business unit stores customer data in an unsanctioned cloud application?",
    structure: ["Identify asset, threat, vulnerability", "Assess likelihood and impact", "Treatment options", "Ownership and follow-up"],
    keyPoints: [kp("Identifies the data and its classification", "data", "classif", "personal", "customer"), kp("Likelihood and impact", "likelihood", "impact", "score", "rating"), kp("Treatment options", "mitigat", "accept", "transfer", "avoid", "treat"), kp("Owner and register", "risk owner", "risk register", "owner", "review date"), kp("Regulatory angle", "gdpr", "regulat", "complian", "contract")],
    followUps: ["The business refuses to stop using the tool. What now?"] },
  { id: "t-cloud", category: "technical", roles: ["cloud-security"], skill: "iam",
    question: "What are the most common identity misconfigurations you would look for in a cloud account, and how would you detect abuse?",
    structure: ["Name three or four misconfiguration classes", "Explain the risk of each", "Point to the log source that would show abuse"],
    keyPoints: [kp("Over-privileged identities", "over-privileged", "least privilege", "admin", "wildcard"), kp("Long-lived keys / no MFA", "access key", "mfa", "long-lived", "rotation"), kp("Public exposure", "public", "bucket", "exposed"), kp("Audit logs", "cloudtrail", "audit log", "activity log", "sign-in log"), kp("Detection of anomalous use", "anomal", "unusual", "new region", "guardduty", "alert")],
    followUps: ["How do you investigate a leaked access key?"] },
  { id: "b-intro", category: "behavioural", roles: ["*"],
    question: "Tell me about yourself and why you are moving into this role.",
    structure: ["Present: what you do now, in one or two sentences", "Past: the two or three experiences most relevant to this role", "Future: why this role and this team", "Keep it under two minutes"],
    keyPoints: [kp("Links past experience to the role", "experience", "background", "worked", "previously"), kp("Shows hands-on practice", "lab", "project", "built", "practised", "practiced", "home lab", "ctf"), kp("Clear motivation", "because", "motivat", "interested", "enjoy", "why")],
    followUps: ["What have you done in the last three months to build these skills?"] },
  { id: "b-pressure", category: "behavioural", roles: ["*"],
    question: "Tell me about a time you had to work under pressure with incomplete information.",
    structure: STAR,
    keyPoints: [kp("Specific situation", "when", "at the time", "last year", "during"), kp("Own actions", "i decided", "i prioritised", "i prioritized", "i asked", "i checked", "i escalated"), kp("Outcome", "result", "outcome", "resolved", "learned", "learnt")],
    followUps: ["What would you do differently next time?"] },
  { id: "b-mistake", category: "behavioural", roles: ["*"],
    question: "Describe a mistake you made at work or in a project. What happened and what did you change afterwards?",
    structure: STAR,
    keyPoints: [kp("Owns the mistake plainly", "my mistake", "i missed", "i assumed", "i should have", "i got it wrong", "my fault"), kp("Explains the fix", "fixed", "corrected", "told", "reported", "raised"), kp("Shows what changed", "since then", "now i", "changed", "checklist", "process", "learned", "learnt")],
    followUps: ["How did you communicate it to your manager or team?"] },
  { id: "b-explain", category: "behavioural", roles: ["*"],
    question: "Give an example of explaining a technical issue to someone non-technical. How did you make sure they understood?",
    structure: STAR,
    keyPoints: [kp("Adapts language to the audience", "plain", "simple", "analogy", "jargon", "non-technical"), kp("Checks understanding", "asked", "confirmed", "checked", "questions", "summar"), kp("Outcome", "result", "decision", "agreed", "resolved")],
    followUps: ["How would you brief an executive during an active incident?"] },
  { id: "b-disagree", category: "behavioural", roles: ["*"],
    question: "Tell me about a time you disagreed with a colleague or a decision. How did you handle it?",
    structure: STAR,
    keyPoints: [kp("States the disagreement fairly", "disagree", "different view", "concern"), kp("Uses evidence, stays professional", "evidence", "data", "listened", "discussed", "proposed"), kp("Resolution", "agreed", "compromise", "decided", "outcome", "result")],
    followUps: ["What if the decision had gone against you?"] },
  { id: "b-learn", category: "behavioural", roles: ["*"],
    question: "How do you keep your security knowledge current, and what is the most recent thing you taught yourself?",
    structure: ["Name your regular sources and habits", "Give one recent, specific example", "Say how you applied it"],
    keyPoints: [kp("Named sources or habits", "blog", "podcast", "newsletter", "report", "course", "lab", "tryhackme", "hack the box", "advisory"), kp("A specific recent example", "recently", "last week", "last month", "this year"), kp("Applied it", "applied", "built", "wrote", "tested", "used it")],
    followUps: ["How do you decide what is worth your time to learn?"] },
  { id: "c-questions", category: "behavioural", roles: ["*"],
    question: "What questions do you have for us about the team, the tooling or the role?",
    structure: ["Ask two or three specific questions", "Show you researched the organisation", "Avoid questions answered in the job description"],
    keyPoints: [kp("Asks about the team or processes", "team", "shift", "escalation", "onboarding", "training", "mentor"), kp("Asks about tooling or coverage", "siem", "edr", "tooling", "stack", "detection", "playbook"), kp("Asks about success in the role", "success", "first 90 days", "expect", "progression", "growth")],
    followUps: [] },
];

export type GeneratedQuestion = { category: string; question: string; guidance: { structure: string[]; keyPoints: KeyPoint[]; anchor?: string }; followUps: string[] };

export function generateQuestions(opts: { role: string; mode: InterviewMode; resume?: Pick<ParsedResume, "skills" | "experience"> | null; job?: ParsedJob | null; seed?: number }): GeneratedQuestion[] {
  const role = ROLE_BY_ID.has(opts.role) ? opts.role : "soc-analyst";
  const jobSkills = new Set([...(opts.job?.requiredSkills ?? []), ...(opts.job?.preferredSkills ?? [])]);
  const resumeSkills = new Set(opts.resume?.skills ?? []);
  let seed = opts.seed ?? 1;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const rank = (q: BankQuestion) =>
    (q.roles.includes(role) ? 3 : 0) + (q.skill && jobSkills.has(q.skill) ? 4 : 0) + (q.skill && ROLE_BY_ID.get(role)!.core.includes(q.skill) ? 1 : 0) + rand();
  const pick = (cats: BankQuestion["category"][], n: number, exclude: string[] = []) =>
    QUESTION_BANK.filter((q) => cats.includes(q.category) && !exclude.includes(q.id) && (q.roles.includes(role) || q.roles.includes("*") || (q.skill && jobSkills.has(q.skill))))
      .sort((a, b) => rank(b) - rank(a)).slice(0, n);

  const intro = QUESTION_BANK.find((q) => q.id === "b-intro")!;
  const close = QUESTION_BANK.find((q) => q.id === "c-questions")!;
  const fixed = [intro.id, close.id];
  const technical = pick(["technical", "scenario"], opts.mode === "technical" ? 5 : opts.mode === "mixed" ? 3 : 0);
  const behavioural = pick(["behavioural"], opts.mode === "behavioural" ? 4 : opts.mode === "mixed" ? 2 : 0, fixed);
  const chosen = [intro, ...technical, ...behavioural, close];

  return chosen.map((q) => {
    let anchor: string | undefined;
    if (q.skill && jobSkills.has(q.skill)) anchor = `The job description lists ${skillLabel(q.skill)} — expect depth here.`;
    if (q.skill && resumeSkills.has(q.skill)) anchor = `${anchor ? anchor + " " : ""}Your resume mentions ${skillLabel(q.skill)}: use a real example from your own work or labs.`;
    else if (q.skill && opts.resume && !resumeSkills.has(q.skill)) anchor = `${anchor ? anchor + " " : ""}Your resume does not mention ${skillLabel(q.skill)}; be honest about your level and explain how you are closing the gap.`;
    if (q.id === "b-intro" && opts.resume?.experience.entries[0]) anchor = `Anchor your answer in your most recent role (${opts.resume.experience.entries[0].context || opts.resume.experience.entries[0].period}).`;
    return { category: q.category, question: q.question, guidance: { structure: q.structure, keyPoints: q.keyPoints, anchor }, followUps: q.followUps };
  });
}

export type AnswerFeedback = { score: number; covered: string[]; missed: string[]; strengths: string[]; improvements: string[]; followUp: string | null; ai?: { feedback: string; improvedOutline: string[] } };

/** Rule-based answer review: coverage of expected points, structure and specificity. A practice aid, not a hiring predictor. */
export function evaluateAnswer(q: { category: string; guidance: { keyPoints?: KeyPoint[] }; followUps: string[] }, answer: string): AnswerFeedback {
  const text = answer.toLowerCase();
  const words = answer.split(/\s+/).filter(Boolean).length;
  const points = q.guidance.keyPoints ?? [];
  const covered = points.filter((p) => p.keywords.some((k) => text.includes(k)));
  const missed = points.filter((p) => !covered.includes(p));
  const coverage = points.length ? covered.length / points.length : 0.5;

  const firstPerson = (text.match(/\bi\b/g) ?? []).length;
  const specific = /\d/.test(answer) || /\b(splunk|sentinel|wireshark|nmap|burp|crowdstrike|defender|sysmon|powershell|python|elastic|wazuh)\b/i.test(answer);
  const hasResult = /\b(result|outcome|resolved|reduced|improved|learned|learnt|prevented|as a result|which meant)\b/.test(text);
  const lengthScore = words < 40 ? 0.3 : words < 90 ? 0.7 : words <= 380 ? 1 : 0.75;

  const strengths: string[] = [], improvements: string[] = [];
  if (covered.length) strengths.push(`Covered: ${covered.map((p) => p.label).join("; ")}.`);
  if (specific) strengths.push("Used specific tools, identifiers or numbers, which makes the answer credible.");
  if (words < 40) improvements.push("The answer is very short. Aim for 60–120 seconds of speaking (roughly 150–300 words).");
  if (words > 380) improvements.push("The answer is long. Lead with your conclusion and trim detail the interviewer has not asked for.");
  if (missed.length) improvements.push(`Not clearly addressed: ${missed.map((p) => p.label).join("; ")}.`);
  if (!specific) improvements.push("Add a concrete detail — a tool, an event ID, a number or a named example.");
  if (q.category === "behavioural") {
    if (firstPerson < 3) improvements.push("Say what you personally did (“I…”), not what the team did.");
    else strengths.push("Described your own actions in the first person.");
    if (!hasResult) improvements.push("Finish with the result and what you learned (the R in STAR).");
    else strengths.push("Closed with an outcome.");
  }
  const structureScore = q.category === "behavioural" ? (Math.min(firstPerson, 4) / 4) * 0.5 + (hasResult ? 0.5 : 0) : specific ? 1 : 0.5;
  const score = Math.round((coverage * 0.55 + structureScore * 0.25 + lengthScore * 0.2) * 100);
  return { score, covered: covered.map((p) => p.label), missed: missed.map((p) => p.label), strengths, improvements, followUp: q.followUps[0] ?? null };
}

export function summariseSession(questions: { category: string; score: number | null; feedback: AnswerFeedback | null }[]) {
  const answered = questions.filter((q) => q.score != null);
  const avg = (rows: typeof answered) => (rows.length ? Math.round(rows.reduce((n, q) => n + (q.score ?? 0), 0) / rows.length) : null);
  const recurring = new Map<string, number>();
  for (const q of answered) for (const i of q.feedback?.improvements ?? []) {
    const key = i.split(/[.:—]/)[0];
    recurring.set(key, (recurring.get(key) ?? 0) + 1);
  }
  return {
    answered: answered.length, total: questions.length, average: avg(answered),
    technical: avg(answered.filter((q) => q.category !== "behavioural")),
    behavioural: avg(answered.filter((q) => q.category === "behavioural")),
    focusAreas: [...recurring.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k),
    note: "Scores reflect coverage of expected points and answer structure in this practice session. They do not predict interview outcomes.",
  };
}
