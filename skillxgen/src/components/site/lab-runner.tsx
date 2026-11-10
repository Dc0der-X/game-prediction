"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { submitLab } from "@/app/learning-actions";
import type { LabResult, SiemEvent } from "@/content/labs";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Q = { id: string; prompt: string; type: "choice" | "text"; options?: string[]; hint?: string };

export function LabRunner({ slug, questions, next, previousScore }: { slug: string; questions: Q[]; next: { href: string; label: string }; previousScore?: string | null }) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<LabResult | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const byId = new Map(result?.results.map((r) => [r.id, r]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await submitLab(slug, answers);
      if (!res.ok || !res.result) { setError(res.message ?? "Could not check your answers."); return; }
      setError(null); setResult(res.result); setSaved(!!res.saved);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="lab-form">
      {previousScore ? <p className="font-mono text-xs text-subtle">Your best saved score: {previousScore}</p> : null}
      {questions.map((q, i) => {
        const r = byId.get(q.id);
        return (
          <fieldset key={q.id} className={cn("rounded-lg border p-5", r ? (r.correct ? "border-success/50" : "border-danger/50") : "border-border")}>
            <legend className="px-1 font-mono text-xs text-primary-hover">Q{i + 1}</legend>
            <p className="font-medium">{q.prompt}</p>
            {q.type === "choice" ? (
              <div className="mt-4 space-y-2">
                {q.options!.map((o, idx) => (
                  <label key={o} className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm text-muted transition-colors has-[:checked]:border-primary has-[:checked]:text-foreground">
                    <input type="radio" name={q.id} value={idx} checked={answers[q.id] === String(idx)} onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(idx) }))} className="mt-0.5 accent-[var(--color-primary)]" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            ) : (
              <Input className="mt-4 max-w-md font-mono" aria-label={q.prompt} name={q.id} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} autoComplete="off" spellCheck={false} />
            )}
            {q.hint && !r ? <details className="mt-3 text-sm text-subtle"><summary className="cursor-pointer">Hint</summary><p className="mt-1">{q.hint}</p></details> : null}
            {r ? (
              <div className="mt-4 flex gap-3 text-sm" data-testid={`result-${q.id}`} data-correct={r.correct}>
                {r.correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
                <div><p className={r.correct ? "text-success" : "text-danger"}>{r.correct ? "Correct" : `Not quite — expected: ${r.expected}`}</p><p className="mt-1 leading-relaxed text-muted">{r.explanation}</p></div>
              </div>
            ) : null}
          </fieldset>
        );
      })}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {result ? (
        <Alert tone={result.score === result.max ? "success" : "info"} data-testid="lab-score">
          <strong>Score: {result.score} / {result.max}.</strong>{" "}
          {saved ? "Saved to your account." : <>Not saved — <Link href="/sign-up" className="underline">create a free account</Link> to keep your progress.</>}
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Checking…" : result ? "Check again" : "Check my answers"}</Button>
        {result ? <Button asChild variant="outline"><Link href={next.href}>{next.label}</Link></Button> : null}
      </div>
    </form>
  );
}

const FIELDS = ["type", "user", "src", "host", "result"] as const;

export function SiemExplorer({ events }: { events: SiemEvent[] }) {
  const [query, setQuery] = React.useState("");
  const [groupBy, setGroupBy] = React.useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = events.filter((e) => terms.every((t) => {
    const m = t.match(/^(\w+)(!?=)(.+)$/);
    if (m && m[1] in e) { const eq = String(e[m[1] as keyof SiemEvent]).toLowerCase() === m[3]; return m[2] === "=" ? eq : !eq; }
    return Object.values(e).some((v) => String(v).toLowerCase().includes(t));
  }));
  const groups = groupBy ? [...filtered.reduce((map, e) => {
    const k = e[groupBy as keyof SiemEvent];
    const g = map.get(k) ?? { count: 0, users: new Set<string>() };
    g.count++; g.users.add(e.user); map.set(k, g); return map;
  }, new Map<string, { count: number; users: Set<string> }>())].sort((a, b) => b[1].count - a[1].count) : [];

  return (
    <div className="overflow-hidden rounded-lg border border-border-strong bg-[#0b0b0e]" data-testid="siem">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-primary-hover">search&gt;</span>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. result=failure src=203.0.113.77" className="h-9 min-w-56 flex-1 font-mono text-xs" aria-label="Search events" spellCheck={false} />
        <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="h-9 w-40 font-mono text-xs" aria-label="Count by field">
          <option value="">Count by…</option>{FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
        <Badge>{filtered.length} / {events.length} events</Badge>
      </div>
      {groupBy ? (
        <table className="w-full border-b border-border font-mono text-xs" data-testid="siem-groups">
          <thead><tr className="text-left text-subtle"><th className="px-3 py-2 font-normal">{groupBy}</th><th className="px-3 py-2 font-normal">count</th><th className="px-3 py-2 font-normal">distinct users</th></tr></thead>
          <tbody>{groups.map(([k, g]) => <tr key={k} className="border-t border-border"><td className="px-3 py-1.5 text-foreground">{k}</td><td className="px-3 py-1.5">{g.count}</td><td className="px-3 py-1.5">{g.users.size}</td></tr>)}</tbody>
        </table>
      ) : null}
      <div className="max-h-80 overflow-auto">
        <table className="w-full font-mono text-[0.72rem]">
          <thead className="sticky top-0 bg-surface text-left text-subtle"><tr>{["time", ...FIELDS, "detail"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr key={i} className="border-t border-border/60 text-[#c9c9d1]">
                <td className="whitespace-nowrap px-3 py-1.5 text-subtle">{e.time}</td><td className="px-3 py-1.5">{e.type}</td><td className="px-3 py-1.5">{e.user}</td><td className="px-3 py-1.5">{e.src}</td><td className="px-3 py-1.5">{e.host}</td>
                <td className={cn("px-3 py-1.5", e.result === "failure" ? "text-danger" : "text-success")}>{e.result}</td><td className="whitespace-nowrap px-3 py-1.5 text-muted">{e.detail}</td>
              </tr>
            ))}
            {!filtered.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-subtle">No events match.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
