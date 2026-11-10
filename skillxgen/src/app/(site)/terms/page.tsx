import type { Metadata } from "next";
import { LegalPage } from "@/components/site/sections";

export const metadata: Metadata = { title: "Terms and Conditions", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" updated="10 November 2026">
      <h2>1. Agreement</h2>
      <p>These terms govern your use of the SkillXGen website, free academy, career tools and paid programmes. By creating an account or enrolling you agree to them.</p>
      <h2>2. Our services</h2>
      <p>We provide education, coaching and software tools. Programme content, schedules and instructors may change; where a change is material we will tell enrolled students in advance.</p>
      <h2>3. No guarantee of outcomes</h2>
      <p><strong>We do not guarantee employment, interviews, salary levels, promotions or certification results.</strong> Statements about careers are general information, not promises. Indicators produced by our career tools describe documents and practice answers; they do not predict screening or hiring decisions.</p>
      <h2>4. Accounts</h2>
      <p>You must be 18 or over, provide accurate information and keep your credentials confidential. You are responsible for activity on your account.</p>
      <h2>5. Fees and payment</h2>
      <p>Fees are shown before purchase in USD, GBP or CAD and charged in the currency selected. Payment is processed by Stripe. Enrolment is confirmed when payment is confirmed to us. Taxes may apply depending on your location.</p>
      <h2>6. Refunds and cancellation</h2>
      <p>Refunds are governed by our <a href="/refund-policy">Refund Policy</a>, which forms part of these terms. Nothing in these terms affects statutory rights you have as a consumer.</p>
      <h2>7. Acceptable use</h2>
      <ul>
        <li>Use offensive security techniques only against systems you own or are explicitly authorised in writing to test.</li>
        <li>Do not attack, probe or disrupt our platform or other learners.</li>
        <li>Do not upload unlawful content, malware or other people's personal data without a lawful basis.</li>
        <li>Do not share paid course materials or your account.</li>
      </ul>
      <p>Breach of this section may result in immediate suspension without refund and, where appropriate, a report to the authorities.</p>
      <h2>8. Academic integrity</h2>
      <p>Assignments must be your own work. Coaching on employer assessments is guidance only; we will not complete an employer's assessment for you.</p>
      <h2>9. Intellectual property</h2>
      <p>Course materials are licensed to you for personal study. You keep ownership of work you submit and grant us a licence to store and review it for the purpose of providing the service. We will not publish your work or name without your written consent.</p>
      <h2>10. AI tools</h2>
      <p>AI-assisted output may be inaccurate or incomplete. Verify it before relying on it. Do not submit confidential third-party information.</p>
      <h2>11. Liability</h2>
      <p>To the extent permitted by law, our total liability relating to a paid service is limited to the fees you paid for it, and we are not liable for indirect or consequential loss. We do not exclude liability that cannot lawfully be excluded.</p>
      <h2>12. Governing law</h2>
      <p>[To be completed by legal counsel: governing law and jurisdiction, taking account of mandatory consumer protections in the customer's country of residence.]</p>
      <h2>13. Contact</h2>
      <p>Questions about these terms can be sent through the <a href="/contact">contact page</a>.</p>
    </LegalPage>
  );
}
