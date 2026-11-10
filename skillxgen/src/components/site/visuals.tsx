// Original SkillXGen graphics, drawn in markup so they stay sharp, themeable and accessible.
import { cn } from "@/lib/utils";

const ALERTS = [
  { sev: "high", time: "09:44:03", rule: "Inbox rule hides messages — possible BEC", entity: "j.okafor", state: "Investigating" },
  { sev: "high", time: "09:41:54", rule: "Impossible travel: GB → NG in 39 min", entity: "j.okafor", state: "Linked" },
  { sev: "med", time: "09:12:20", rule: "Password spray: 61 accounts, 1 source", entity: "203.0.113.77", state: "Open" },
  { sev: "low", time: "08:58:11", rule: "Encoded PowerShell from deployment agent", entity: "SRV-APP3", state: "Benign" },
  { sev: "med", time: "08:31:47", rule: "Office app spawned script interpreter", entity: "WS-077", state: "Open" },
];
const SEV = { high: "bg-primary", med: "bg-warning", low: "bg-subtle" } as const;

export function TriageConsole({ className }: { className?: string }) {
  return (
    <figure className={cn("overflow-hidden rounded-lg border border-border-strong bg-[#0b0b0e] shadow-2xl shadow-black/60", className)} aria-label="Illustration of an alert triage queue">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary" /><span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Alert queue · training lab</span></div>
        <span className="font-mono text-[0.7rem] text-subtle">UTC</span>
      </div>
      <ul className="divide-y divide-border">
        {ALERTS.map((a, i) => (
          <li key={a.time} className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3", i === 0 && "bg-primary-soft/50")}>
            <span className={cn("h-8 w-1 rounded-sm", SEV[a.sev as keyof typeof SEV])} aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.rule}</p>
              <p className="font-mono text-[0.7rem] text-subtle">{a.time} · {a.entity}</p>
            </div>
            <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-wider", i === 0 ? "border-primary/60 text-primary-hover" : "border-border-strong text-muted")}>{a.state}</span>
          </li>
        ))}
      </ul>
      <figcaption className="border-t border-border bg-surface px-4 py-3">
        <p className="font-mono text-[0.7rem] leading-relaxed text-muted">
          <span className="text-primary-hover">analyst&gt;</span> second sign-in satisfied MFA by token, unknown device.<br />
          <span className="text-primary-hover">analyst&gt;</span> rule created 3 min later moves “invoice” mail to RSS Feeds.<br />
          <span className="text-success">verdict&gt;</span> true positive — revoke sessions, remove rule, escalate.
        </p>
      </figcaption>
    </figure>
  );
}

export function AttackChain({ className, steps = ["Recon", "Initial access", "Execution", "Persistence", "Lateral movement", "Impact"], active = 1 }: { className?: string; steps?: string[]; active?: number }) {
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-3 lg:grid-cols-6", className)} aria-label="Attack lifecycle">
      {steps.map((s, i) => (
        <li key={s} className={cn("relative border border-border bg-card px-3 py-3", i === active && "border-primary/70 bg-primary-soft/50")}>
          <span className="font-mono text-[0.65rem] text-subtle">{String(i + 1).padStart(2, "0")}</span>
          <p className="mt-1 text-sm font-medium">{s}</p>
        </li>
      ))}
    </ol>
  );
}

export function TopologyGraphic({ className }: { className?: string }) {
  const nodes = [
    { x: 60, y: 110, label: "Internet", hot: false }, { x: 190, y: 110, label: "Firewall", hot: false }, { x: 320, y: 50, label: "Web app", hot: true },
    { x: 320, y: 170, label: "Workstation", hot: false }, { x: 450, y: 110, label: "Domain controller", hot: false }, { x: 450, y: 30, label: "Database", hot: false },
  ];
  const edges = [[0, 1], [1, 2], [1, 3], [2, 5], [3, 4], [2, 4]];
  return (
    <svg viewBox="0 0 520 210" className={cn("w-full", className)} role="img" aria-label="Diagram of a lab network used for authorised penetration testing">
      {edges.map(([a, b]) => <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#3a3a45" strokeWidth="1.2" strokeDasharray={a === 2 ? "4 4" : undefined} />)}
      {nodes.map((n) => (
        <g key={n.label}>
          <rect x={n.x - 9} y={n.y - 9} width="18" height="18" fill={n.hot ? "#e5192b" : "#131317"} stroke={n.hot ? "#ff3344" : "#6f6f7b"} strokeWidth="1.2" />
          <text x={n.x} y={n.y + 26} textAnchor="middle" fill="#a3a3ad" fontSize="10" fontFamily="JetBrains Mono Variable, monospace">{n.label}</text>
        </g>
      ))}
      <text x="320" y="24" textAnchor="middle" fill="#ff3344" fontSize="9" fontFamily="JetBrains Mono Variable, monospace">IN SCOPE</text>
    </svg>
  );
}

export function LogBlock({ lines, className, label }: { lines: string[]; className?: string; label?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-[#0b0b0e]", className)}>
      {label ? <p className="border-b border-border px-4 py-2 font-mono text-[0.68rem] uppercase tracking-widest text-subtle">{label}</p> : null}
      <pre className="overflow-x-auto p-4 font-mono text-[0.76rem] leading-relaxed text-[#c9c9d1]">{lines.join("\n")}</pre>
    </div>
  );
}
