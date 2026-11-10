// SkillXGen cybersecurity skills taxonomy. Authored for this project (not derived from any third-party dataset).

export type SkillCategory = "detection" | "endpoint" | "network" | "systems" | "cloud" | "scripting" | "response" | "threat" | "vulnerability" | "offensive" | "governance" | "professional";

export type Skill = { id: string; label: string; category: SkillCategory; aliases: string[] };

const s = (id: string, label: string, category: SkillCategory, ...aliases: string[]): Skill => ({ id, label, category, aliases: [label.toLowerCase(), ...aliases] });

export const SKILLS: Skill[] = [
  s("siem", "SIEM", "detection", "security information and event management"),
  s("splunk", "Splunk", "detection", "spl"),
  s("sentinel", "Microsoft Sentinel", "detection", "azure sentinel", "sentinel", "kql"),
  s("elastic", "Elastic Security", "detection", "elk", "elastic stack", "elasticsearch", "kibana"),
  s("qradar", "IBM QRadar", "detection", "qradar"),
  s("wazuh", "Wazuh", "detection"),
  s("log-analysis", "Log analysis", "detection", "log review", "analysing logs", "analyzing logs", "event logs", "windows event"),
  s("detection-engineering", "Detection engineering", "detection", "detection rules", "sigma", "correlation rules", "use case development"),
  s("alert-triage", "Alert triage", "detection", "triage", "alert investigation", "alert handling"),
  s("edr", "EDR", "endpoint", "endpoint detection and response", "xdr"),
  s("crowdstrike", "CrowdStrike Falcon", "endpoint", "crowdstrike"),
  s("defender", "Microsoft Defender", "endpoint", "defender for endpoint", "mde"),
  s("sentinelone", "SentinelOne", "endpoint"),
  s("sysmon", "Sysmon", "endpoint"),
  s("tcpip", "TCP/IP networking", "network", "tcp/ip", "networking fundamentals", "osi model", "subnetting"),
  s("wireshark", "Wireshark", "network", "packet analysis", "pcap", "tcpdump"),
  s("firewalls", "Firewalls", "network", "firewall", "palo alto", "fortinet", "fortigate"),
  s("ids-ips", "IDS/IPS", "network", "ids", "ips", "snort", "suricata", "zeek"),
  s("dns", "DNS", "network"),
  s("proxy", "Web proxy", "network", "zscaler", "proxy logs"),
  s("windows", "Windows administration", "systems", "windows server", "active directory", "group policy"),
  s("active-directory", "Active Directory", "systems", "entra id", "azure ad", "kerberos", "ldap"),
  s("linux", "Linux", "systems", "bash", "ubuntu", "kali"),
  s("aws", "AWS", "cloud", "amazon web services", "cloudtrail", "guardduty"),
  s("azure", "Microsoft Azure", "cloud", "azure"),
  s("gcp", "Google Cloud", "cloud", "gcp"),
  s("iam", "Identity and access management", "cloud", "iam", "sso", "mfa", "okta"),
  s("python", "Python", "scripting"),
  s("powershell", "PowerShell", "scripting"),
  s("sql", "SQL", "scripting"),
  s("automation", "Security automation", "scripting", "soar", "playbooks", "automation"),
  s("incident-response", "Incident response", "response", "ir", "incident handling", "containment", "nist 800-61"),
  s("phishing", "Phishing analysis", "response", "phishing", "email analysis", "email security"),
  s("malware-analysis", "Malware analysis", "response", "malware", "sandbox", "any.run", "static analysis"),
  s("forensics", "Digital forensics", "response", "dfir", "forensic", "memory analysis", "volatility", "autopsy"),
  s("reporting", "Incident reporting", "response", "incident report", "documentation", "ticketing", "servicenow", "jira"),
  s("mitre", "MITRE ATT&CK", "threat", "att&ck", "mitre"),
  s("threat-intel", "Threat intelligence", "threat", "cti", "ioc", "indicators of compromise", "virustotal", "osint"),
  s("threat-hunting", "Threat hunting", "threat", "hunting", "hypothesis-driven"),
  s("kill-chain", "Cyber Kill Chain", "threat", "kill chain"),
  s("vuln-management", "Vulnerability management", "vulnerability", "vulnerability assessment", "vulnerability scanning", "patch management", "cvss"),
  s("nessus", "Nessus", "vulnerability", "tenable", "qualys", "openvas"),
  s("owasp", "OWASP Top 10", "offensive", "owasp", "web application security"),
  s("burp", "Burp Suite", "offensive", "burp"),
  s("nmap", "Nmap", "offensive", "port scanning"),
  s("metasploit", "Metasploit", "offensive"),
  s("pentest", "Penetration testing", "offensive", "pentest", "pen testing", "ethical hacking", "red team"),
  s("privilege-escalation", "Privilege escalation", "offensive", "privesc"),
  s("ad-attacks", "Active Directory attacks", "offensive", "bloodhound", "kerberoasting", "pass the hash"),
  s("report-writing", "Pentest report writing", "offensive", "findings report", "remediation advice"),
  s("iso27001", "ISO 27001", "governance", "iso/iec 27001"),
  s("nist-csf", "NIST CSF", "governance", "nist cybersecurity framework", "nist 800-53"),
  s("soc2", "SOC 2", "governance"),
  s("risk", "Risk assessment", "governance", "risk management", "risk register"),
  s("gdpr", "Data protection (GDPR)", "governance", "gdpr", "data protection", "privacy"),
  s("policy", "Security policy", "governance", "policies and procedures", "audit", "compliance"),
  s("communication", "Communication", "professional", "stakeholder", "presented", "briefed"),
  s("teamwork", "Collaboration", "professional", "cross-functional", "collaborated", "teamwork"),
  s("customer-service", "Customer service", "professional", "help desk", "service desk", "customer support"),
];

export const SKILL_BY_ID = new Map(SKILLS.map((x) => [x.id, x]));

export type Cert = { id: string; label: string; level: "entry" | "intermediate" | "advanced"; aliases: string[] };
const c = (id: string, label: string, level: Cert["level"], ...aliases: string[]): Cert => ({ id, label, level, aliases: [label.toLowerCase(), ...aliases] });

export const CERTS: Cert[] = [
  c("security-plus", "CompTIA Security+", "entry", "security+", "sec+"),
  c("network-plus", "CompTIA Network+", "entry", "network+"),
  c("isc2-cc", "ISC2 Certified in Cybersecurity", "entry", "isc2 cc", "certified in cybersecurity"),
  c("google-cyber", "Google Cybersecurity Certificate", "entry", "google cybersecurity"),
  c("cysa", "CompTIA CySA+", "intermediate", "cysa+", "cysa"),
  c("btl1", "Blue Team Level 1", "entry", "btl1"),
  c("sc-200", "Microsoft SC-200", "intermediate", "sc-200", "security operations analyst associate"),
  c("az-500", "Microsoft AZ-500", "intermediate", "az-500"),
  c("splunk-user", "Splunk Core Certified User", "entry", "splunk core certified"),
  c("ccna", "Cisco CCNA", "entry", "ccna"),
  c("pentest-plus", "CompTIA PenTest+", "intermediate", "pentest+"),
  c("ejpt", "eJPT", "entry", "ejpt", "junior penetration tester"),
  c("pnpt", "PNPT", "intermediate", "pnpt"),
  c("ceh", "Certified Ethical Hacker", "intermediate", "ceh"),
  c("oscp", "OSCP", "advanced", "oscp", "offensive security certified professional"),
  c("gcih", "GIAC GCIH", "intermediate", "gcih"),
  c("gsec", "GIAC GSEC", "intermediate", "gsec"),
  c("aws-security", "AWS Certified Security – Specialty", "advanced", "aws security specialty", "aws certified security"),
  c("cissp", "CISSP", "advanced", "cissp"),
  c("cisa", "CISA", "advanced", "cisa"),
  c("iso-lead", "ISO 27001 Lead Implementer", "intermediate", "lead implementer", "lead auditor"),
];

const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matcher = (aliases: string[]) => new RegExp(`(?<![a-z0-9])(?:${aliases.map(esc).join("|")})(?![a-z0-9])`, "i");
const SKILL_PATTERNS = SKILLS.map((x) => ({ id: x.id, re: matcher(x.aliases) }));
const CERT_PATTERNS = CERTS.map((x) => ({ id: x.id, re: matcher(x.aliases) }));

export const extractSkillIds = (text: string) => SKILL_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
export const extractCertIds = (text: string) => CERT_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
export const skillLabel = (id: string) => SKILL_BY_ID.get(id)?.label ?? id;
export const certLabel = (id: string) => CERTS.find((x) => x.id === id)?.label ?? id;

export type RoleProfile = {
  id: string; title: string; summary: string; programme: string;
  core: string[]; desirable: string[]; certs: string[];
  projects: { title: string; description: string; skills: string[] }[];
  phases: { title: string; weeks: number; focus: string[]; skills: string[] }[];
};

export const ROLES: RoleProfile[] = [
  {
    id: "soc-analyst", title: "SOC Analyst (Tier 1)", programme: "soc-analyst",
    summary: "Monitors alerts, triages and investigates suspicious activity, escalates confirmed incidents and documents findings.",
    core: ["siem", "log-analysis", "alert-triage", "tcpip", "windows", "phishing", "incident-response", "mitre", "reporting"],
    desirable: ["splunk", "sentinel", "edr", "linux", "threat-intel", "wireshark", "python", "active-directory"],
    certs: ["security-plus", "btl1", "sc-200", "cysa"],
    projects: [
      { title: "Home SOC lab", description: "Deploy an open-source SIEM, forward Windows and Linux logs, and write five detections mapped to MITRE ATT&CK.", skills: ["siem", "log-analysis", "mitre", "wazuh"] },
      { title: "Phishing investigation casebook", description: "Analyse ten sample phishing emails: headers, URLs, attachments and a verdict with evidence for each.", skills: ["phishing", "threat-intel", "reporting"] },
      { title: "Incident report portfolio", description: "Write three incident reports (brute force, malware execution, data exfiltration) with timeline, scope and recommendations.", skills: ["incident-response", "reporting"] },
    ],
    phases: [
      { title: "Foundations", weeks: 4, focus: ["Networking and protocols", "Windows and Linux fundamentals", "Security principles (CIA, defence in depth)"], skills: ["tcpip", "windows", "linux", "dns"] },
      { title: "SOC operations", weeks: 5, focus: ["SIEM searching and dashboards", "Alert triage workflow", "Windows event and Sysmon analysis"], skills: ["siem", "log-analysis", "alert-triage", "sysmon"] },
      { title: "Investigation skills", weeks: 5, focus: ["Phishing analysis", "Endpoint investigation with EDR", "MITRE ATT&CK mapping and threat intelligence"], skills: ["phishing", "edr", "mitre", "threat-intel"] },
      { title: "Incident response and reporting", weeks: 3, focus: ["NIST incident response lifecycle", "Escalation and containment decisions", "Writing clear incident reports"], skills: ["incident-response", "reporting"] },
      { title: "Job readiness", weeks: 3, focus: ["Portfolio projects", "Resume and LinkedIn", "Technical and behavioural interview practice"], skills: ["communication"] },
    ],
  },
  {
    id: "incident-responder", title: "Incident Responder", programme: "soc-analyst",
    summary: "Leads investigation, containment and recovery for confirmed security incidents.",
    core: ["incident-response", "log-analysis", "edr", "forensics", "malware-analysis", "mitre", "reporting", "windows", "tcpip"],
    desirable: ["siem", "threat-hunting", "python", "powershell", "active-directory", "aws", "automation"],
    certs: ["cysa", "gcih", "sc-200", "security-plus"],
    projects: [
      { title: "Ransomware tabletop and runbook", description: "Design a containment runbook and run a tabletop exercise against a simulated ransomware outbreak.", skills: ["incident-response", "reporting"] },
      { title: "Memory and disk triage", description: "Triage a public forensic image: identify persistence, lateral movement and exfiltration evidence.", skills: ["forensics", "malware-analysis", "mitre"] },
    ],
    phases: [
      { title: "SOC and detection baseline", weeks: 5, focus: ["SIEM investigation", "Endpoint telemetry", "ATT&CK technique recognition"], skills: ["siem", "log-analysis", "edr", "mitre"] },
      { title: "Response methodology", weeks: 4, focus: ["NIST and SANS lifecycles", "Containment strategies", "Evidence handling"], skills: ["incident-response", "forensics"] },
      { title: "Deep-dive analysis", weeks: 6, focus: ["Malware triage", "Windows forensics artefacts", "Scripting for response"], skills: ["malware-analysis", "forensics", "powershell", "python"] },
      { title: "Communication and practice", weeks: 3, focus: ["Executive and technical reporting", "Tabletop exercises", "Interview scenarios"], skills: ["reporting", "communication"] },
    ],
  },
  {
    id: "threat-hunter", title: "Threat Hunter / Detection Analyst", programme: "ai-in-cybersecurity",
    summary: "Proactively searches telemetry for attacker behaviour and turns findings into detections.",
    core: ["threat-hunting", "siem", "log-analysis", "mitre", "detection-engineering", "edr", "threat-intel", "tcpip"],
    desirable: ["python", "sentinel", "splunk", "sysmon", "automation", "malware-analysis", "aws"],
    certs: ["cysa", "sc-200", "btl1", "gcih"],
    projects: [
      { title: "Hypothesis-driven hunt series", description: "Run and document four hunts (encoded PowerShell, rare parent-child processes, beaconing, new admin accounts).", skills: ["threat-hunting", "log-analysis", "mitre"] },
      { title: "Detection-as-code repository", description: "Write Sigma rules with tests and ATT&CK coverage notes; convert to your SIEM's query language.", skills: ["detection-engineering", "siem"] },
    ],
    phases: [
      { title: "Telemetry fluency", weeks: 5, focus: ["Windows, Sysmon and EDR data", "Network and DNS telemetry", "Query languages (SPL / KQL)"], skills: ["log-analysis", "sysmon", "edr", "siem"] },
      { title: "Adversary behaviour", weeks: 4, focus: ["ATT&CK tactics and techniques", "Threat intelligence reports", "Attack chain reconstruction"], skills: ["mitre", "threat-intel", "kill-chain"] },
      { title: "Hunting and detection", weeks: 6, focus: ["Hypothesis design", "Baselining and stacking", "Rule writing and tuning"], skills: ["threat-hunting", "detection-engineering"] },
      { title: "Automation and AI assistance", weeks: 3, focus: ["Scripting hunts", "Using LLMs safely for analysis", "Measuring detection quality"], skills: ["python", "automation"] },
    ],
  },
  {
    id: "penetration-tester", title: "Junior Penetration Tester", programme: "penetration-testing",
    summary: "Performs authorised security testing of networks and applications and reports findings with remediation advice.",
    core: ["pentest", "tcpip", "linux", "nmap", "owasp", "burp", "privilege-escalation", "report-writing", "vuln-management"],
    desirable: ["python", "active-directory", "ad-attacks", "metasploit", "windows", "aws", "powershell"],
    certs: ["ejpt", "pentest-plus", "pnpt", "oscp"],
    projects: [
      { title: "Web application assessment report", description: "Test a deliberately vulnerable application and produce a professional report with CVSS-rated findings.", skills: ["owasp", "burp", "report-writing"] },
      { title: "Internal network lab", description: "Build an Active Directory lab, compromise it within an agreed scope, and document the attack path and fixes.", skills: ["ad-attacks", "privilege-escalation", "nmap"] },
    ],
    phases: [
      { title: "Foundations", weeks: 4, focus: ["Networking", "Linux command line", "Scripting basics", "Legal scope and rules of engagement"], skills: ["tcpip", "linux", "python"] },
      { title: "Recon and enumeration", weeks: 4, focus: ["Scanning and service enumeration", "Vulnerability identification", "Methodology and note-taking"], skills: ["nmap", "vuln-management"] },
      { title: "Web application testing", weeks: 5, focus: ["OWASP Top 10", "Burp Suite workflow", "Authentication and access-control testing"], skills: ["owasp", "burp"] },
      { title: "Exploitation and privilege escalation", weeks: 5, focus: ["Linux and Windows privilege escalation", "Active Directory attack paths", "Pivoting in labs"], skills: ["privilege-escalation", "ad-attacks", "metasploit"] },
      { title: "Reporting and readiness", weeks: 3, focus: ["Findings write-ups", "Remediation guidance", "Practical exam and interview practice"], skills: ["report-writing", "communication"] },
    ],
  },
  {
    id: "grc-analyst", title: "GRC Analyst", programme: "career-transition",
    summary: "Supports risk assessments, policy, audits and compliance with security frameworks.",
    core: ["risk", "policy", "iso27001", "nist-csf", "gdpr", "communication", "reporting"],
    desirable: ["soc2", "vuln-management", "iam", "aws", "azure", "teamwork"],
    certs: ["security-plus", "isc2-cc", "iso-lead", "cisa"],
    projects: [
      { title: "Risk register for a fictional SME", description: "Identify assets and threats, score risks and propose treatments mapped to ISO 27001 Annex A.", skills: ["risk", "iso27001"] },
      { title: "Policy pack", description: "Draft an acceptable-use policy, an incident response policy and an access-control standard.", skills: ["policy", "communication"] },
    ],
    phases: [
      { title: "Security fundamentals", weeks: 4, focus: ["Core security concepts", "How organisations are attacked", "Technology basics for auditors"], skills: ["tcpip", "iam"] },
      { title: "Frameworks", weeks: 5, focus: ["ISO 27001", "NIST CSF", "SOC 2 and data protection"], skills: ["iso27001", "nist-csf", "soc2", "gdpr"] },
      { title: "Risk and audit practice", weeks: 5, focus: ["Risk assessment methods", "Control testing", "Evidence collection"], skills: ["risk", "policy"] },
      { title: "Communication", weeks: 2, focus: ["Writing for executives", "Stakeholder interviews", "Interview preparation"], skills: ["communication", "reporting"] },
    ],
  },
  {
    id: "cloud-security", title: "Cloud Security Analyst", programme: "ai-in-cybersecurity",
    summary: "Monitors and secures cloud workloads, identities and configurations.",
    core: ["aws", "azure", "iam", "log-analysis", "siem", "incident-response", "vuln-management", "tcpip"],
    desirable: ["python", "automation", "sentinel", "detection-engineering", "linux", "gcp", "policy"],
    certs: ["security-plus", "az-500", "sc-200", "aws-security"],
    projects: [
      { title: "Cloud detection lab", description: "Enable audit logging in a free-tier account, simulate risky activity and build detections for it.", skills: ["aws", "log-analysis", "detection-engineering"] },
      { title: "IAM review", description: "Audit a sample cloud environment for over-privileged identities and write a remediation plan.", skills: ["iam", "reporting"] },
    ],
    phases: [
      { title: "Cloud and security foundations", weeks: 5, focus: ["Core cloud services", "Shared responsibility model", "Networking in the cloud"], skills: ["aws", "azure", "tcpip"] },
      { title: "Identity and configuration", weeks: 4, focus: ["IAM design and review", "Misconfiguration classes", "Posture management"], skills: ["iam", "vuln-management"] },
      { title: "Cloud detection and response", weeks: 5, focus: ["Audit log analysis", "Cloud-native detections", "Cloud incident response"], skills: ["log-analysis", "siem", "incident-response"] },
      { title: "Automation", weeks: 3, focus: ["Scripting with SDKs", "Automated response", "Interview preparation"], skills: ["python", "automation"] },
    ],
  },
];

export const ROLE_BY_ID = new Map(ROLES.map((r) => [r.id, r]));
