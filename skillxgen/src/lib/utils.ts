import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Currency = "usd" | "gbp" | "cad";
export const CURRENCIES: { code: Currency; label: string; locale: string }[] = [
  { code: "usd", label: "USD $", locale: "en-US" },
  { code: "gbp", label: "GBP £", locale: "en-GB" },
  { code: "cad", label: "CAD $", locale: "en-CA" },
];
export const isCurrency = (v: unknown): v is Currency => v === "usd" || v === "gbp" || v === "cad";

export function formatMoney(minor: number, currency: Currency) {
  const c = CURRENCIES.find((x) => x.code === currency)!;
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: currency === "cad" ? "symbol" : "narrowSymbol",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" } : {}),
  }).format(date);
}

export const titleCase = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function csvEscape(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
