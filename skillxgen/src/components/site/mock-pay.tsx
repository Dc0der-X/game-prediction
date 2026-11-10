"use client";
import { InlineAction } from "@/components/form";
import { simulateMockPayment } from "@/app/checkout/actions";

export function MockPayButtons({ paymentId }: { paymentId: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <InlineAction action={simulateMockPayment} fields={{ payment_id: paymentId, outcome: "paid" }} variant="default" size="default" data-testid="mock-pay-success">Simulate successful payment</InlineAction>
      <InlineAction action={simulateMockPayment} fields={{ payment_id: paymentId, outcome: "failed" }} size="default" data-testid="mock-pay-fail">Simulate failed payment</InlineAction>
    </div>
  );
}
