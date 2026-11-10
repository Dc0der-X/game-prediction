import type { Metadata } from "next";
import { LegalPage } from "@/components/site/sections";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="10 November 2026">
      <h2>1. Who we are</h2>
      <p>SkillXGen (“we”, “us”) provides cybersecurity education and career development services to learners in the United States, the United Kingdom and Canada. We are the controller of the personal data described here. Contact us through the <a href="/contact">contact page</a> for any privacy request.</p>
      <h2>2. Data we collect</h2>
      <ul>
        <li><strong>Account data</strong> — name, email address, and profile details you choose to add. Authentication is handled by our identity provider (Clerk); we do not store your password when Clerk is used.</li>
        <li><strong>Enquiry data</strong> — what you tell us in forms: country, career level, skills, target role, programme interest, budget range and your message.</li>
        <li><strong>Learning data</strong> — enrolments, lesson progress, lab attempts, assignment submissions and instructor feedback.</li>
        <li><strong>Career-tool data</strong> — resumes and job descriptions you upload or paste, and the analyses, assessments and interview practice generated from them.</li>
        <li><strong>Payment data</strong> — amount, currency, status and receipt number. Card details are handled entirely by Stripe and never reach our servers.</li>
        <li><strong>Technical data</strong> — IP address and request metadata used for security, rate limiting and audit logs; privacy-friendly aggregate analytics where enabled.</li>
      </ul>
      <h2>3. How we use it and our legal bases</h2>
      <table>
        <thead><tr><th>Purpose</th><th>Legal basis (UK/EU GDPR)</th></tr></thead>
        <tbody>
          <tr><td>Providing courses, tools and support you request</td><td>Contract</td></tr>
          <tr><td>Responding to enquiries</td><td>Legitimate interests / steps prior to contract</td></tr>
          <tr><td>Marketing email</td><td>Consent — you can withdraw at any time</td></tr>
          <tr><td>Security, fraud prevention, audit logging</td><td>Legitimate interests</td></tr>
          <tr><td>Financial records</td><td>Legal obligation</td></tr>
          <tr><td>Publishing testimonials or outcomes</td><td>Your explicit written consent</td></tr>
        </tbody>
      </table>
      <h2>4. AI processing</h2>
      <p>The career tools produce rule-based analysis on our own servers. Where an AI provider is enabled, the text of your resume, job description or answer is sent to that provider solely to generate feedback for you. We do not use your documents to train models. Tool outputs are guidance only and are not used to make automated decisions about you.</p>
      <h2>5. Who we share data with</h2>
      <p>Service providers acting on our instructions: identity (Clerk), database and file hosting, payments (Stripe), transactional email (Resend), analytics (self-hosted or EU-hosted Umami) and, where enabled, an AI provider. We do not sell personal data. We disclose data where the law requires it.</p>
      <h2>6. International transfers</h2>
      <p>Our providers may process data outside your country. Where required we rely on appropriate safeguards such as standard contractual clauses or the UK International Data Transfer Addendum.</p>
      <h2>7. Retention</h2>
      <ul>
        <li>Account and learning data: for the life of your account, then deleted or anonymised within 90 days of a deletion request.</li>
        <li>Enquiries that do not become enrolments: up to 24 months.</li>
        <li>Payment records: as long as tax and accounting law requires (typically six to seven years).</li>
        <li>Security and audit logs: up to 12 months.</li>
      </ul>
      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have rights to access, correct, delete, restrict or port your data, to object to processing, and to withdraw consent. Residents of California have rights under the CCPA/CPRA; residents of Canada under PIPEDA; residents of the UK and EU under the GDPR. You can submit an export or deletion request from your profile, or contact us. You may also complain to your data protection authority (in the UK, the ICO).</p>
      <h2>9. Marketing and unsubscribe</h2>
      <p>We send marketing email only if you opt in. Every message includes an unsubscribe link that takes effect immediately. Transactional messages (receipts, verification, replies to your enquiry) are not marketing.</p>
      <h2>10. Cookies</h2>
      <p>We use essential cookies for sign-in and for remembering your currency preference. We do not use advertising cookies. Analytics, where enabled, is cookieless.</p>
      <h2>11. Children</h2>
      <p>Our services are for adults. We do not knowingly collect data from anyone under 18.</p>
      <h2>12. Security</h2>
      <p>We apply access controls at the database level, encrypt data in transit, restrict staff access by role, and log administrative actions. No system is perfectly secure; we will notify you and regulators of a breach where the law requires.</p>
      <h2>13. Changes</h2>
      <p>We will post changes here and, where they are significant, notify account holders by email.</p>
    </LegalPage>
  );
}
