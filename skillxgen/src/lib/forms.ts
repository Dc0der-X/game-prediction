import { z } from "zod";

export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string[]>; data?: Record<string, unknown> } | null;

export const fail = (message: string, errors?: Record<string, string[]>): ActionState => ({ ok: false, message, errors });
export const ok = (message?: string, data?: Record<string, unknown>): ActionState => ({ ok: true, message, data });

export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$ACTION")) o[k] = v;
  return o;
}

export function parseForm<T extends z.ZodType>(schema: T, fd: FormData): { data: z.infer<T>; error?: undefined } | { data?: undefined; error: ActionState } {
  const r = schema.safeParse(formToObject(fd));
  if (r.success) return { data: r.data };
  const errors: Record<string, string[]> = {};
  for (const i of r.error.issues) (errors[String(i.path[0] ?? "form")] ??= []).push(i.message);
  return { error: fail("Please correct the highlighted fields.", errors) };
}

// Shared field schemas
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
export const text = (max: number, min = 1) => z.string().transform(clean).pipe(z.string().min(min, min > 0 ? "Required" : undefined).max(max, `Maximum ${max} characters`));
export const optionalText = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Maximum ${max} characters`)).optional().transform((v) => (v ? v : null));
export const email = z.string().transform((s) => s.trim().toLowerCase()).pipe(z.email("Enter a valid email address").max(254));
export const checkbox = z.union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal("false"), z.literal("")]).optional().transform((v) => v === "on" || v === "true" || v === "1");
export const uuid = z.uuid("Invalid identifier");
export const password = z.string().min(10, "Use at least 10 characters").max(200).refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Include at least one letter and one number");

export const COUNTRIES = ["United States", "United Kingdom", "Canada", "Other"] as const;
export const CAREER_LEVELS = ["Student / no experience", "Career changer (non-IT)", "IT professional (0-2 years)", "IT professional (3+ years)", "Working in security"] as const;
export const BUDGET_RANGES = ["Not sure yet", "Under $500", "$500 – $1,500", "$1,500 – $2,500", "$2,500+"] as const;
