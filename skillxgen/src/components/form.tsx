"use client";
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/forms";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ErrorsContext = React.createContext<Record<string, string[]>>({});

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({ action, children, className, resetOnSuccess = false, successReplaces = false, ...rest }:
  { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; successReplaces?: boolean } & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action">) {
  const [state, formAction] = useActionState(action, null);
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  if (state?.ok && successReplaces) return <Alert tone="success" data-testid="form-success">{state.message}</Alert>;
  return (
    <form ref={ref} action={formAction} className={cn("space-y-4", className)} noValidate {...rest}>
      <ErrorsContext.Provider value={state?.errors ?? {}}>
        {children}
        {state?.message ? <Alert tone={state.ok ? "success" : "danger"} data-testid={state.ok ? "form-success" : "form-error"}>{state.message}</Alert> : null}
      </ErrorsContext.Provider>
    </form>
  );
}

export function Field({ name, label, hint, children, className }: { name: string; label: string; hint?: string; children?: React.ReactNode; className?: string }) {
  const errors = React.useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { id, name, "aria-invalid": errors ? true : undefined, "aria-describedby": errors ? `${id}-err` : hint ? `${id}-hint` : undefined })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {child}
      {hint && !errors ? <p id={`${id}-hint`} className="text-xs text-subtle">{hint}</p> : null}
      {errors ? <p id={`${id}-err`} className="text-xs text-danger">{errors[0]}</p> : null}
    </div>
  );
}

export function CheckboxField({ name, children, defaultChecked }: { name: string; children: React.ReactNode; defaultChecked?: boolean }) {
  const errors = React.useContext(ErrorsContext)[name];
  return (
    <div>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]" />
        <span>{children}</span>
      </label>
      {errors ? <p className="mt-1 text-xs text-danger">{errors[0]}</p> : null}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}

/** Small inline form for single-button server actions (mark read, approve, delete…). */
export function InlineAction({ action, children, fields = {}, confirm, ...props }:
  { action: Action; children: React.ReactNode; fields?: Record<string, string>; confirm?: string } & Omit<ButtonProps, "children">) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1" onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton size="sm" variant="outline" {...props}>{children}</SubmitButton>
      {state?.message ? <span className={cn("text-xs", state.ok ? "text-success" : "text-danger")} data-testid={state.ok ? "inline-success" : "inline-error"}>{state.message}</span> : null}
    </form>
  );
}

export { Input, Select, Textarea };
