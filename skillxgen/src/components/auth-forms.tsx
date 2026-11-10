"use client";
import Link from "next/link";
import { ActionForm, CheckboxField, Field, Input, SubmitButton } from "@/components/form";
import { forgotPasswordAction, loginAction, registerAction, resendVerificationAction, resetPasswordAction } from "@/app/(auth)/actions";

export function LocalSignIn({ redirectUrl }: { redirectUrl?: string }) {
  return (
    <ActionForm action={loginAction}>
      <input type="hidden" name="redirect_url" value={redirectUrl ?? ""} />
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <Field name="password" label="Password"><Input type="password" autoComplete="current-password" required /></Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-sm text-muted"><Link href="/forgot-password" className="text-primary-hover hover:underline">Forgot your password?</Link></p>
    </ActionForm>
  );
}

export function LocalSignUp() {
  return (
    <ActionForm action={registerAction}>
      <Field name="full_name" label="Full name"><Input autoComplete="name" required /></Field>
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <Field name="password" label="Password" hint="At least 10 characters, with a letter and a number."><Input type="password" autoComplete="new-password" required /></Field>
      <CheckboxField name="terms">I agree to the <Link href="/terms" className="text-primary-hover hover:underline">Terms</Link> and <Link href="/privacy" className="text-primary-hover hover:underline">Privacy Policy</Link>.</CheckboxField>
      <CheckboxField name="marketing_consent">Send me occasional emails about free labs and webinars. Optional — unsubscribe any time.</CheckboxField>
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
    </ActionForm>
  );
}

export function ForgotPassword() {
  return (
    <ActionForm action={forgotPasswordAction}>
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </ActionForm>
  );
}

export function ResendVerification({ email }: { email?: string }) {
  return (
    <ActionForm action={resendVerificationAction}>
      <Field name="email" label="Email"><Input type="email" defaultValue={email} required /></Field>
      <SubmitButton variant="outline" className="w-full">Resend verification email</SubmitButton>
    </ActionForm>
  );
}

export function ResetPassword({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction}>
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="New password" hint="At least 10 characters, with a letter and a number."><Input type="password" autoComplete="new-password" required /></Field>
      <SubmitButton className="w-full">Set new password</SubmitButton>
    </ActionForm>
  );
}
