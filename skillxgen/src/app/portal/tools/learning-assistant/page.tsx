import { requireViewer } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { EXERCISES, TOPICS } from "@/lib/career/assistant";
import { formatDate } from "@/lib/utils";
import { PageTitle } from "@/components/app-shell";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { LogBlock } from "@/components/site/visuals";
import { AssistantForm } from "@/components/portal/tool-forms";
import { AiStatusBanner } from "@/components/portal/ai-status";

export const metadata = { title: "Learning Assistant" };

export default async function LearningAssistantPage() {
  const viewer = await requireViewer("/portal/tools/learning-assistant");
  const history = await withUser(viewer, (sql) => sql`select id, topic, prompt, response, engine, created_at from learning_sessions where user_id = ${viewer.id} order by created_at desc limit 8`);
  return (
    <>
      <PageTitle title="Cybersecurity Learning Assistant">Ask about SOC investigation, SIEM searches, incident response, phishing analysis or threat hunting, then work through the guided exercises below.</PageTitle>
      <AiStatusBanner viewer={viewer} />
      <Card><CardContent><AssistantForm topics={TOPICS.map((t) => ({ id: t.id, label: t.label }))} /></CardContent></Card>

      <h2 className="kicker mb-4 mt-12">Guided exercises</h2>
      <div className="space-y-4">
        {EXERCISES.map((ex) => (
          <details key={ex.id} className="group rounded-lg border border-border bg-card" data-testid={`exercise-${ex.id}`}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span><span className="font-medium group-open:text-primary-hover">{ex.title}</span><span className="mt-0.5 block text-sm text-muted">{ex.scenario}</span></span>
              <Badge>{TOPICS.find((t) => t.id === ex.topic)?.label}</Badge>
            </summary>
            <div className="space-y-5 border-t border-border p-5">
              <LogBlock label="Evidence" lines={ex.evidence.split("\n")} />
              <ol className="space-y-4">
                {ex.tasks.map((t, i) => (
                  <li key={t.prompt} className="text-sm">
                    <p className="font-medium"><span className="mr-2 font-mono text-xs text-primary-hover">{i + 1}</span>{t.prompt}</p>
                    <details className="mt-1.5 text-muted"><summary className="cursor-pointer text-subtle hover:text-foreground">Hint</summary><p className="mt-1">{t.hint}</p></details>
                    <details className="mt-1 text-muted"><summary className="cursor-pointer text-subtle hover:text-foreground">Show model answer</summary><p className="mt-1 leading-relaxed">{t.answer}</p></details>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>

      {history.length ? (
        <>
          <h2 className="kicker mb-4 mt-12">Your recent questions</h2>
          <div className="space-y-3">
            {history.map((h) => (
              <details key={h.id} className="rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-3 text-sm [&::-webkit-details-marker]:hidden"><span className="font-medium">{h.prompt}</span><span className="ml-2 font-mono text-xs text-subtle">{formatDate(h.created_at)} · {h.engine}</span></summary>
                <div className="border-t border-border p-4"><Markdown className="text-sm">{h.response}</Markdown></div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
