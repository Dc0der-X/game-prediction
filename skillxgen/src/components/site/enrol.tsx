"use client";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { startCheckout } from "@/app/checkout/actions";
import type { Currency } from "@/lib/utils";

export function EnrolForm({ programme, currency, signedIn }: { programme: string; currency: Currency; signedIn: boolean }) {
  return (
    <ActionForm action={startCheckout} data-testid="enrol-form">
      <input type="hidden" name="programme" value={programme} />
      <input type="hidden" name="currency" value={currency} />
      <Field name="coupon" label="Coupon code (optional)"><Input autoComplete="off" placeholder="e.g. DEMO10" /></Field>
      <SubmitButton className="w-full" size="lg" pendingLabel="Starting checkout…">{signedIn ? "Enrol and pay securely" : "Sign in to enrol"}</SubmitButton>
      <p className="text-xs text-subtle">Payment is processed by Stripe. Your place is confirmed only when Stripe confirms the payment. See the <Link href="/refund-policy" className="underline">Refund Policy</Link>.</p>
    </ActionForm>
  );
}
