// Cybersecurity Learning Assistant: a curated knowledge base and guided exercises that work without any AI
// provider. When a provider is configured, the same knowledge is used to ground the model's answer.

export type Topic = "soc-investigation" | "siem" | "incident-response" | "phishing" | "threat-hunting";
export const TOPICS: { id: Topic; label: string; description: string }[] = [
  { id: "soc-investigation", label: "SOC investigation", description: "Alert triage, evidence gathering and escalation decisions." },
  { id: "siem", label: "SIEM practice", description: "Searching logs, building detections and tuning noise." },
  { id: "incident-response", label: "Incident response", description: "Containment, eradication, recovery and reporting." },
  { id: "phishing", label: "Phishing analysis", description: "Headers, links, attachments and scoping." },
  { id: "threat-hunting", label: "Threat hunting", description: "Hypothesis-driven hunts and turning findings into detections." },
];

export type KbEntry = { id: string; topics: Topic[]; title: string; keywords: string[]; body: string };

export const KNOWLEDGE: KbEntry[] = [
  { id: "triage-flow", topics: ["soc-investigation"], title: "A repeatable alert triage flow", keywords: ["triage", "alert", "investigate", "start", "first", "workflow", "process", "steps"],
    body: "1. **Understand the alert** — what rule fired, on which data, and what it is trying to detect.\n2. **Identify the entities** — user, host, source/destination IP, process, file hash.\n3. **Gather context** — is this normal for this user/host? Check asset criticality, recent changes and related alerts.\n4. **Corroborate** — look for supporting evidence in a second data source (endpoint, proxy, identity).\n5. **Decide** — true positive, benign true positive, or false positive. State the evidence for the decision.\n6. **Act and document** — contain or escalate according to the playbook, and write notes another analyst could follow." },
  { id: "tp-fp", topics: ["soc-investigation", "siem"], title: "True positive, false positive, benign true positive", keywords: ["false positive", "true positive", "benign", "fp", "tp", "classification", "noise"],
    body: "- **True positive**: the detection fired on the malicious behaviour it was written for.\n- **Benign true positive**: the behaviour really happened but is authorised (an admin running a scanner, a pentest).\n- **False positive**: the rule matched something it was not meant to.\n\nRecord *why* you classified it. Repeated false positives are a tuning task — raise them rather than silently closing." },
  { id: "escalation", topics: ["soc-investigation", "incident-response"], title: "When to escalate", keywords: ["escalate", "escalation", "tier 2", "severity", "priority", "handover"],
    body: "Escalate when any of these is true: confirmed compromise of an account or host; evidence of lateral movement, data access or exfiltration; a critical asset or privileged identity is involved; the activity is ongoing; or the playbook tells you to. A good escalation includes: what happened, the timeline, entities involved, evidence, what you have already done, and what you need." },
  { id: "event-ids", topics: ["soc-investigation", "siem", "threat-hunting"], title: "Windows event IDs worth memorising", keywords: ["event id", "4624", "4625", "4688", "4720", "4672", "windows event", "logon type", "security log"],
    body: "| ID | Meaning |\n|---|---|\n| 4624 | Successful logon (check **Logon Type**: 2 interactive, 3 network, 10 remote desktop) |\n| 4625 | Failed logon (sub-status explains why) |\n| 4648 | Logon using explicit credentials |\n| 4672 | Special privileges assigned (admin logon) |\n| 4688 | Process creation (enable command-line logging) |\n| 4720 / 4726 | User account created / deleted |\n| 4728 / 4732 | Member added to a security-enabled global / local group |\n| 7045 | New service installed (System log) |\n| 1102 | Security log cleared |" },
  { id: "sysmon", topics: ["siem", "threat-hunting"], title: "Sysmon events for investigations", keywords: ["sysmon", "process creation", "network connection", "event id 1", "event id 3", "parent process"],
    body: "Sysmon adds detail native logging lacks: **1** process creation with hashes and parent command line, **3** network connection per process, **7** image loaded, **8** CreateRemoteThread, **10** process access (credential dumping against LSASS), **11** file created, **12–14** registry changes, **22** DNS query. Parent–child relationships (for example Word spawning PowerShell) are one of the highest-value signals." },
  { id: "brute-force", topics: ["siem", "soc-investigation"], title: "Brute force vs password spraying", keywords: ["brute force", "password spray", "spraying", "failed login", "failed logon", "lockout", "credential stuffing"],
    body: "**Brute force**: many passwords against one account — many 4625 events for one user from one source.\n**Password spraying**: one or two common passwords against many accounts — one source, many distinct users, few attempts each, often spaced to avoid lockouts.\n**Credential stuffing**: breached username/password pairs replayed, usually against internet-facing services.\n\nDetection logic for spraying: count *distinct target accounts* with failed logons per source over a time window, then look for any success from the same source." },
  { id: "detection-logic", topics: ["siem"], title: "Writing a detection", keywords: ["detection", "rule", "query", "correlation", "sigma", "use case", "write a rule", "threshold"],
    body: "1. Describe the behaviour in plain language and map it to an ATT&CK technique.\n2. Identify the log source and confirm the fields exist and are populated.\n3. Write the simplest logic that matches the behaviour.\n4. Test against known-good and known-bad data.\n5. Tune: exclude documented benign sources narrowly (never by broad wildcard).\n6. Document: purpose, false-positive notes, triage steps and severity.\n\nA rule nobody knows how to triage is not finished." },
  { id: "query-basics", topics: ["siem"], title: "Query patterns that transfer between SIEMs", keywords: ["spl", "kql", "query", "search", "stats", "summarize", "count by", "filter", "syntax"],
    body: "Most investigations use the same four moves regardless of language:\n- **Filter** to the data and time range: `index=auth action=failure` / `SigninLogs | where ResultType != 0`\n- **Aggregate**: `stats count by src_ip, user` / `summarize count() by IPAddress, UserPrincipalName`\n- **Find rare values**: sort ascending by count (stacking).\n- **Pivot**: take an entity from one result and search every data source for it.\n\nLearn the moves; the syntax follows." },
  { id: "ir-lifecycle", topics: ["incident-response"], title: "Incident response lifecycle", keywords: ["lifecycle", "phases", "nist", "800-61", "containment", "eradication", "recovery", "lessons learned", "preparation"],
    body: "NIST SP 800-61 describes four phases:\n1. **Preparation** — playbooks, tooling, contacts, logging.\n2. **Detection and analysis** — confirm, scope, prioritise.\n3. **Containment, eradication and recovery** — stop the spread, remove the cause, restore safely and monitor.\n4. **Post-incident activity** — lessons learned, detection and control improvements.\n\nContainment choices are trade-offs: isolating a host stops spread but can tip off an attacker and destroy volatile evidence. Follow your playbook and record the decision." },
  { id: "containment", topics: ["incident-response"], title: "Containment options", keywords: ["contain", "isolate", "quarantine", "disable account", "block", "reset password", "revoke"],
    body: "- **Host**: network-isolate via EDR (keeps the agent connection for investigation).\n- **Identity**: reset the password, revoke sessions and tokens, enforce MFA re-registration.\n- **Network**: block the indicator at proxy, DNS or firewall.\n- **Email**: purge the message from all mailboxes, block the sender and URL.\n\nAlways check for persistence before declaring an account or host clean: mailbox rules, OAuth grants, scheduled tasks, new services, new accounts." },
  { id: "incident-report", topics: ["incident-response", "soc-investigation"], title: "What a good incident report contains", keywords: ["report", "write up", "writeup", "documentation", "timeline", "executive summary", "template"],
    body: "1. **Executive summary** — what happened, impact, current status, in plain language.\n2. **Timeline** — timestamped (state the time zone) from first evidence to closure.\n3. **Scope** — affected users, hosts and data.\n4. **Analysis** — evidence, root cause, ATT&CK mapping.\n5. **Response actions** — containment, eradication, recovery.\n6. **Recommendations** — specific, owned and prioritised.\n7. **Indicators** — hashes, domains, IPs (defanged).\n\nSeparate fact from assessment, and say what you could not determine." },
  { id: "email-auth", topics: ["phishing"], title: "SPF, DKIM and DMARC", keywords: ["spf", "dkim", "dmarc", "authentication-results", "header", "spoof", "return-path"],
    body: "- **SPF** checks whether the sending server is authorised for the *envelope* (Return-Path) domain.\n- **DKIM** verifies a cryptographic signature over the message for the signing domain.\n- **DMARC** requires SPF or DKIM to pass *and align* with the visible From domain, and tells receivers what to do on failure.\n\nA pass does not mean safe: attackers register look-alike domains with perfectly valid SPF/DKIM, or send from compromised legitimate mailboxes." },
  { id: "phish-headers", topics: ["phishing"], title: "Reading email headers", keywords: ["header", "received", "reply-to", "message-id", "originating ip", "x-originating", "sender"],
    body: "Read `Received` headers bottom-up to trace the path. Compare **From**, **Reply-To** and **Return-Path**: a mismatch is a common tell. Check `Authentication-Results`. Note the sending IP and look up its reputation and owner. Display names are free text — always inspect the actual address." },
  { id: "phish-url", topics: ["phishing"], title: "Analysing links and attachments safely", keywords: ["url", "link", "attachment", "sandbox", "defang", "virustotal", "urlscan", "macro", "html attachment", "qr"],
    body: "Never open suspicious links or files on your workstation. Defang indicators when sharing (`hxxps://example[.]com`). Use a sandbox or URL scanner, and remember that submitting to a public service may disclose the sample. Check: the real destination behind shorteners and redirects, domain age, look-alike characters, whether a credential form is present. For attachments: file type vs extension, macros, embedded links, and the hash." },
  { id: "phish-scope", topics: ["phishing", "incident-response"], title: "Scoping a phishing incident", keywords: ["scope", "who clicked", "recipients", "message trace", "credentials entered", "compromised mailbox"],
    body: "Answer four questions: **Who received it?** (message trace) **Who clicked?** (proxy / DNS / URL-rewriting logs) **Who submitted credentials or ran the file?** (sign-in logs, EDR) **What happened next?** (new inbox rules, MFA changes, unusual sign-ins, mail sent). Then purge the message, block indicators, reset affected accounts and revoke sessions." },
  { id: "attack", topics: ["threat-hunting", "soc-investigation"], title: "Using MITRE ATT&CK", keywords: ["mitre", "att&ck", "tactic", "technique", "ttp", "mapping"],
    body: "ATT&CK catalogues adversary **tactics** (the goal: initial access, execution, persistence…) and **techniques** (how: T1566 Phishing, T1059 Command and Scripting Interpreter, T1078 Valid Accounts). Use it to label what you observe, to ask “what would come next?”, and to review which techniques you have telemetry and detections for. It is a vocabulary and a map, not a checklist to complete." },
  { id: "hunt-method", topics: ["threat-hunting"], title: "Running a hypothesis-driven hunt", keywords: ["hunt", "hypothesis", "hunting", "proactive", "baseline", "stacking", "rare"],
    body: "1. **Hypothesis**: “If an attacker used technique X here, I would see Y in data source Z.”\n2. **Scope** the data and time range.\n3. **Search and stack**: count occurrences and study the rare ones.\n4. **Investigate** outliers to a conclusion.\n5. **Record** the query, findings and gaps — including “no evidence found” and telemetry you lacked.\n6. **Convert** useful logic into a detection.\n\nA hunt that finds nothing but exposes a logging gap is still a successful hunt." },
  { id: "powershell", topics: ["threat-hunting", "soc-investigation"], title: "Suspicious PowerShell", keywords: ["powershell", "encoded", "-enc", "base64", "encodedcommand", "iex", "downloadstring", "script block", "4104"],
    body: "Signals worth hunting: `-EncodedCommand`/`-enc`, `-NoProfile -WindowStyle Hidden`, `IEX`, `DownloadString`, `FromBase64String`, and PowerShell launched by Office applications, script hosts or from temp folders. Enable Script Block Logging (4104) to see decoded content. Decode Base64 commands (they are UTF-16LE) before judging — plenty of legitimate management software uses encoding too." },
  { id: "beaconing", topics: ["threat-hunting", "siem"], title: "Spotting command-and-control beaconing", keywords: ["beacon", "c2", "command and control", "periodic", "interval", "jitter", "dns tunnel", "tunnelling", "tunneling"],
    body: "Beacons are regular outbound connections from an implant. Look for: consistent intervals between connections from one host to one destination, small uniform request sizes, rare destinations few hosts talk to, newly registered domains, and long-lived or high-volume DNS queries with long random-looking sub-domains (possible DNS tunnelling). Jitter blurs the timing, so combine timing with rarity." },
  { id: "ioc", topics: ["threat-hunting", "soc-investigation", "phishing"], title: "Indicators and the Pyramid of Pain", keywords: ["ioc", "indicator", "hash", "pyramid of pain", "threat intel", "reputation", "virustotal"],
    body: "Hashes, IPs and domains are easy for an attacker to change; tools and **behaviours (TTPs)** are costly to change. Use indicators for quick scoping (“has anything else touched this domain?”) but build detections on behaviour where you can. Treat reputation lookups as one input: a clean verdict is not proof of safety, and shared hosting makes IP reputation noisy." },
  { id: "lateral", topics: ["threat-hunting", "incident-response"], title: "Lateral movement signals", keywords: ["lateral movement", "psexec", "rdp", "smb", "wmi", "pass the hash", "remote service", "admin share"],
    body: "Watch for: logon type 3 or 10 between workstations (which rarely talk to each other), new services created remotely (7045), use of admin shares (`ADMIN$`, `C$`), WMI or WinRM process creation from remote sources, and an account authenticating to many hosts in a short time. Baseline your administrators' normal tooling first." },
];

export type Exercise = { id: string; topic: Topic; title: string; scenario: string; evidence: string; tasks: { prompt: string; hint: string; answer: string }[] };

export const EXERCISES: Exercise[] = [
  { id: "ex-impossible-travel", topic: "soc-investigation", title: "Impossible travel sign-in",
    scenario: "An identity alert fires for user j.okafor: a successful sign-in from London at 09:02 UTC and another from Lagos at 09:41 UTC the same day.",
    evidence: "09:02:11Z  SignIn  user=j.okafor  ip=81.2.69.160   country=GB  app=Outlook  mfa=satisfied  device=WIN-JO-LT (compliant)\n09:41:54Z  SignIn  user=j.okafor  ip=197.210.54.12  country=NG  app=Office365 Shell  mfa=satisfied(token)  device=unknown\n09:44:03Z  MailboxRule  user=j.okafor  action=New-InboxRule  name=\".\"  condition=subject contains 'invoice'  moveTo=RSS Feeds",
    tasks: [
      { prompt: "Which single piece of evidence most strongly suggests compromise rather than a VPN false positive?", hint: "Look at what happened after the second sign-in.", answer: "The inbox rule created three minutes later that hides messages containing ‘invoice’ in the RSS Feeds folder — a classic business-email-compromise persistence and concealment step. The unknown device and token-satisfied MFA support it." },
      { prompt: "MFA shows as satisfied on the second sign-in. How can that be if the user was not there?", hint: "Think about what is stolen in adversary-in-the-middle phishing.", answer: "A stolen session token (for example via adversary-in-the-middle phishing) replays an already-MFA’d session, so no new MFA prompt is needed." },
      { prompt: "List your containment actions in order.", hint: "Identity first, then persistence.", answer: "Revoke all sessions/refresh tokens and reset the password; remove the malicious inbox rule and check for others, forwarding and OAuth grants; review mail sent and accessed since 09:41; block the IP; search for the original phishing email and other recipients; escalate as a confirmed account compromise." },
    ] },
  { id: "ex-spray", topic: "siem", title: "Find the password spray",
    scenario: "You are given a morning of authentication failures. Decide whether there is an attack and whether it succeeded.",
    evidence: "src_ip          distinct_users  failures  successes  window\n10.20.4.17      1               42        0          08:00-08:05\n203.0.113.77    61              64        1          08:10-08:40\n10.20.9.2       3               5         3          08:00-09:00\n198.51.100.23   2               2         2          08:30-08:31",
    tasks: [
      { prompt: "Which source is password spraying, and what tells you?", hint: "Compare distinct users with failures.", answer: "203.0.113.77 — 61 distinct accounts with roughly one failure each over 30 minutes from one external source. 10.20.4.17 is the opposite pattern (one account, many failures): a brute force or a misconfigured service." },
      { prompt: "What is the most urgent follow-up question?", hint: "Look at the successes column.", answer: "Which account produced the one success from 203.0.113.77, and what did that session do afterwards. That account must be treated as compromised." },
      { prompt: "Describe the detection logic you would deploy.", hint: "Aggregate by source over a window.", answer: "Per source IP over a 30–60 minute window: count distinct target accounts with failed logons; alert above a threshold (for example 15), and raise severity when the same source also has a success. Exclude documented internal scanners and identity proxies narrowly." },
    ] },
  { id: "ex-ransom", topic: "incident-response", title: "First hour of a ransomware alert",
    scenario: "EDR reports mass file renames with a new extension on file server FS02 at 02:14, originating from the account svc_backup logged in from workstation WS-117.",
    evidence: "02:09  WS-117  4624 type=10  user=svc_backup  src=WS-044\n02:11  WS-117  4688  cmd=\"vssadmin delete shadows /all /quiet\"\n02:13  FS02    4624 type=3   user=svc_backup  src=WS-117\n02:14  FS02    EDR   mass rename *.docx -> *.lk9  process=svhost.exe (unsigned)",
    tasks: [
      { prompt: "What do you contain first, and why those things?", hint: "Think host, identity, and the direction of travel.", answer: "Network-isolate FS02 and WS-117 via EDR to stop encryption and spread; disable svc_backup and revoke its sessions because the credential is in attacker hands; then isolate WS-044, the previous hop. Keep hosts powered on to preserve memory." },
      { prompt: "What does the vssadmin command tell you?", hint: "It is a recovery-inhibiting step.", answer: "The attacker deleted volume shadow copies to prevent easy restoration (ATT&CK T1490 Inhibit System Recovery) — a strong ransomware precursor, and a high-fidelity detection opportunity before encryption starts." },
      { prompt: "Name three things you must establish before recovery begins.", hint: "Scope, entry, persistence.", answer: "The initial access vector and earliest compromise time; the full scope of affected hosts and accounts (and whether data was exfiltrated); and that persistence is removed and backups are clean and offline before restoring." },
    ] },
  { id: "ex-invoice", topic: "phishing", title: "The invoice email",
    scenario: "Finance forwards an email titled “Overdue invoice INV-20931” asking them to view a document.",
    evidence: "From: \"Accounts — Northwind Supplies\" <billing@northwind-supplies.co>\nReply-To: accounts.northwind@proton.me\nReturn-Path: <bounce@mail.nw-billing.top>\nAuthentication-Results: spf=pass smtp.mailfrom=mail.nw-billing.top; dkim=none; dmarc=fail header.from=northwind-supplies.co\nReceived: from mail.nw-billing.top (185.220.101.4)\nLink text: View invoice  →  hxxps://northwind-supplies.sharepoint.com.docs-view[.]top/login",
    tasks: [
      { prompt: "SPF passes. Why is the message still failing authentication overall?", hint: "Alignment.", answer: "SPF passes only for the envelope domain mail.nw-billing.top, which does not align with the visible From domain northwind-supplies.co, and there is no DKIM signature — so DMARC fails." },
      { prompt: "What is the real registered domain in the link?", hint: "Read right to left from the first single slash.", answer: "docs-view[.]top. Everything before it (northwind-supplies.sharepoint.com.) is just a sub-domain chosen to look legitimate." },
      { prompt: "Give three further indicators that support a phishing verdict.", hint: "Compare the three address headers; look at the theme.", answer: "Reply-To on a free webmail domain that differs from From; Return-Path on an unrelated .top domain; urgency around an overdue invoice plus a login page behind a ‘document’ link (credential harvesting)." },
    ] },
  { id: "ex-encoded", topic: "threat-hunting", title: "Hunt: Office spawning PowerShell",
    scenario: "Hypothesis: a user opened a malicious document that launched PowerShell. Review one day of process-creation results.",
    evidence: "host     parent           child            command_line\nWS-021   explorer.exe     powershell.exe   powershell.exe -File C:\\IT\\Scripts\\map-drives.ps1\nWS-077   WINWORD.EXE      powershell.exe   powershell -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA...\nSRV-APP3 sccm-agent.exe   powershell.exe   powershell.exe -EncodedCommand JABlAHIAcgBvAHIAQQBjAHQAaQBvAG4A...\nWS-077   powershell.exe   rundll32.exe     rundll32.exe C:\\Users\\m.chen\\AppData\\Local\\Temp\\k3.dll,Start",
    tasks: [
      { prompt: "Which row is the strongest lead and why?", hint: "Parent process plus flags.", answer: "WS-077: Word spawning PowerShell with -nop, a hidden window and an encoded command. Office applications should not normally launch PowerShell; the decoded prefix is ‘IEX (New-Object Net.WebClient)’, a download cradle." },
      { prompt: "Why is the SRV-APP3 row probably benign, and how would you confirm rather than assume?", hint: "Baseline.", answer: "Its parent is the software-management agent, which routinely runs encoded commands. Confirm by decoding the command, checking the agent’s signature and path, and verifying the same command appears across many managed hosts." },
      { prompt: "What does the last row add, and what are your next two steps?", hint: "Follow the process chain.", answer: "It shows PowerShell on WS-077 loading a DLL from the user’s Temp folder via rundll32 — second-stage execution. Next: isolate WS-077 and collect the DLL hash, network connections and the source document; then search the estate for that hash, the destination and the same parent-child pattern." },
    ] },
];

export function searchKnowledge(question: string, topic?: Topic | null, limit = 3): KbEntry[] {
  const q = question.toLowerCase();
  const tokens = q.split(/[^a-z0-9&+-]+/).filter((t) => t.length > 2);
  return KNOWLEDGE.map((e) => {
    let s = 0;
    for (const k of e.keywords) if (q.includes(k)) s += k.includes(" ") ? 4 : 3;
    for (const t of tokens) if (e.title.toLowerCase().includes(t)) s += 1;
    if (topic && e.topics.includes(topic)) s += 1.5;
    return { e, s };
  }).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.e);
}

export function answerFromKnowledge(question: string, topic?: Topic | null): { text: string; sources: string[] } {
  const hits = searchKnowledge(question, topic);
  if (!hits.length) {
    const related = KNOWLEDGE.filter((e) => !topic || e.topics.includes(topic)).slice(0, 5).map((e) => `- ${e.title}`).join("\n");
    return { text: `I could not match that question to the built-in study notes. Try rephrasing with the specific concept (for example “password spraying”, “DMARC”, “containment”), or explore these notes:\n\n${related}\n\nAn administrator can connect an AI provider for open-ended questions.`, sources: [] };
  }
  const exercise = EXERCISES.find((x) => hits[0].topics.includes(x.topic));
  const text = hits.map((h) => `### ${h.title}\n\n${h.body}`).join("\n\n") + (exercise ? `\n\n**Practise it:** try the exercise “${exercise.title}”.` : "");
  return { text, sources: hits.map((h) => h.title) };
}
