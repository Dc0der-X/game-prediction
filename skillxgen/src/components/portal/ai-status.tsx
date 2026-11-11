import Link from "next/link";
import { getAiStatus } from "@/lib/ai/provider";
import { can, type Viewer } from "@/lib/auth";
import { Alert } from "@/components/ui/card";

/** Explicit configuration state for the AI layer, shown on every tool. */
export async function AiStatusBanner({ viewer }: { viewer: Viewer }) {
  const status = await getAiStatus();
  if (status.configured && status.enabled) return <p className="mb-6 font-mono text-xs text-subtle" data-testid="ai-status" data-state="enabled">AI review: on · {status.provider} · {status.model}. Rule-based analysis always runs first.</p>;
  return (
    <Alert className="mb-6" data-testid="ai-status" data-state={status.configured ? "disabled" : "not-configured"}>
      <strong>{status.configured ? "AI review is switched off." : "AI review is not configured."}</strong> This tool is running on SkillXGen&apos;s rule-based analysis, which works without any AI provider.
      {can(viewer, "settings.manage") ? <> <Link href="/admin/ai" className="underline">Open AI configuration</Link>.</> : " An administrator can connect a provider to add written AI feedback."}
    </Alert>
  );
}

export function ToolDisclaimer({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-subtle">{children}</p>;
}
