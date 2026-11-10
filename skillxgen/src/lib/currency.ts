import { cookies, headers } from "next/headers";
import { isCurrency, type Currency } from "./utils";

export const CURRENCY_COOKIE = "sxg_currency";

/** Display currency: explicit visitor choice, else country hint from the edge, else browser locale, else USD. */
export async function getCurrency(): Promise<Currency> {
  const chosen = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (isCurrency(chosen)) return chosen;
  const h = await headers();
  const country = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? "").toUpperCase();
  if (country === "GB") return "gbp";
  if (country === "CA") return "cad";
  if (country === "US") return "usd";
  const lang = (h.get("accept-language") ?? "").split(",")[0]?.toLowerCase() ?? "";
  if (lang.endsWith("-gb")) return "gbp";
  if (lang.endsWith("-ca")) return "cad";
  return "usd";
}
