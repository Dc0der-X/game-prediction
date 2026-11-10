import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// react-markdown does not render raw HTML, so stored content cannot inject markup or scripts.
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-sx", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ href, children: c }) => {
          const safe = href && /^(https?:\/\/|\/|#|mailto:)/i.test(href) ? href : "#";
          const external = /^https?:\/\//i.test(safe);
          return <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{c}</a>;
        },
        img: () => null,
      }}>{children}</ReactMarkdown>
    </div>
  );
}
