import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-5 pb-0", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold leading-snug", className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

const badgeVariants = cva("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-wider", {
  variants: {
    variant: {
      default: "border-border-strong text-muted",
      primary: "border-primary/60 bg-primary-soft text-primary-hover",
      success: "border-success/40 bg-success/10 text-success",
      warning: "border-warning/40 bg-warning/10 text-warning",
      danger: "border-danger/40 bg-danger/10 text-danger",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Alert({ className, tone = "info", ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: "info" | "success" | "warning" | "danger" }) {
  const tones = { info: "border-border-strong bg-elevated text-foreground", success: "border-success/40 bg-success/10 text-success", warning: "border-warning/40 bg-warning/10 text-warning", danger: "border-danger/40 bg-danger/10 text-danger" };
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm leading-relaxed", tones[tone], className)} {...props} />;
}

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-sm bg-elevated", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className="h-full bg-primary transition-[width]" style={{ width: `${v}%` }} />
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="w-full overflow-x-auto rounded-lg border border-border"><table className={cn("w-full text-left text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-elevated [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-mono [&_th]:text-[0.68rem] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted", className)} {...props} /></div>;
}
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center"><p className="font-medium">{title}</p>{children ? <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div> : null}</div>;
}
