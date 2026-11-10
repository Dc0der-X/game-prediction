import type { Currency } from "../utils";

export type Priced = { price_usd: number | null; price_gbp: number | null; price_cad: number | null; enquiry_only: boolean };
export type Coupon = {
  id: string; code: string; percent_off: number | null; amount_off: number | null; currency: Currency | null;
  programme_id: string | null; max_redemptions: number | null; redeemed_count: number;
  valid_from: Date | null; valid_until: Date | null; active: boolean;
};

export function priceFor(p: Priced, currency: Currency): number | null {
  if (p.enquiry_only) return null;
  return { usd: p.price_usd, gbp: p.price_gbp, cad: p.price_cad }[currency] ?? null;
}

export function couponProblem(c: Coupon | undefined, programmeId: string, currency: Currency, now = new Date()): string | null {
  if (!c || !c.active) return "That coupon code is not valid.";
  if (c.valid_from && c.valid_from > now) return "That coupon is not active yet.";
  if (c.valid_until && c.valid_until < now) return "That coupon has expired.";
  if (c.max_redemptions != null && c.redeemed_count >= c.max_redemptions) return "That coupon has been fully redeemed.";
  if (c.programme_id && c.programme_id !== programmeId) return "That coupon does not apply to this programme.";
  if (c.amount_off != null && c.currency !== currency) return `That coupon only applies to ${c.currency?.toUpperCase()} prices.`;
  return null;
}

/** Returns the discount in minor units. A coupon can never take the price below 50 minor units (Stripe minimum). */
export function discountFor(amount: number, c: Coupon): number {
  const raw = c.percent_off != null ? Math.floor((amount * c.percent_off) / 100) : (c.amount_off ?? 0);
  return Math.max(0, Math.min(raw, amount - 50));
}
