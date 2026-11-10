import * as React from "react";
import { cn } from "@/lib/utils";

const base = "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus-visible:border-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-hover disabled:opacity-50 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-10 file:mr-3 file:border-0 file:bg-elevated file:px-3 file:py-1 file:text-xs file:text-foreground", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-28 py-2 leading-relaxed", className)} {...props} />;
}
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23a3a3ad%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-8", className)} {...props}>{children}</select>;
}
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}
