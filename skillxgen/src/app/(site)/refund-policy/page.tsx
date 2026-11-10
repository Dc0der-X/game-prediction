import type { Metadata } from "next";
import { LegalPage } from "@/components/site/sections";

export const metadata: Metadata = { title: "Refund Policy", alternates: { canonical: "/refund-policy" } };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy" updated="10 November 2026">
      <h2>1. Our approach</h2>
      <p>We want you to enrol only if a programme is right for you. Try the free academy and speak to us first. If you enrol and change your mind, the terms below apply.</p>
      <h2>2. Cooling-off period</h2>
      <p>You may cancel for a full refund within <strong>14 days of payment</strong>, provided you have not completed more than 20% of the programme content. Consumers in the UK have statutory cancellation rights for distance contracts; nothing here reduces them.</p>
      <h2>3. After the cooling-off period</h2>
      <table>
        <thead><tr><th>When you cancel</th><th>Refund</th></tr></thead>
        <tbody>
          <tr><td>Before the cohort start date</td><td>100%</td></tr>
          <tr><td>Within the first two weeks of teaching</td><td>75%</td></tr>
          <tr><td>Weeks three and four</td><td>50%</td></tr>
          <tr><td>After week four</td><td>No refund, except where required by law</td></tr>
        </tbody>
      </table>
      <h2>4. Short services</h2>
      <p>For Interview Preparation, Resume and LinkedIn Services and Job Support: a full refund is available before the first session or review call. After delivery has begun, the undelivered portion is refunded pro rata.</p>
      <h2>5. If we cancel or change a programme</h2>
      <p>If we cancel a cohort or make a material change you do not accept, you may transfer to another cohort or receive a full refund of fees for undelivered teaching.</p>
      <h2>6. What is not refundable</h2>
      <ul>
        <li>Third-party exam vouchers or fees paid to other organisations.</li>
        <li>Accounts suspended for breach of the acceptable-use or academic-integrity terms.</li>
      </ul>
      <h2>7. How to request a refund</h2>
      <p>Open a billing support request from your dashboard or use the <a href="/contact">contact page</a>, quoting your receipt number. We acknowledge within two working days. Approved refunds are returned to the original payment method through Stripe, usually within 5–10 working days.</p>
      <h2>8. No outcome-based refunds</h2>
      <p>Because we do not guarantee employment or exam results, refunds are not available on the basis that you did not obtain a job or pass an exam.</p>
    </LegalPage>
  );
}
