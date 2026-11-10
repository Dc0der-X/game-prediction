// Central, lazy access to configuration. Nothing here throws at import time so the app can
// build and render public pages before optional services are configured.
const read = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const isProduction = () => process.env.NODE_ENV === "production";
export const siteUrl = () => (read("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

export type AuthProvider = "clerk" | "local" | "unconfigured";
export function authProvider(): AuthProvider {
  const explicit = read("AUTH_PROVIDER");
  const clerkReady = !!read("CLERK_SECRET_KEY") && !!read("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const localAllowed = !isProduction() || read("LOCAL_AUTH_ALLOW_PRODUCTION") === "true";
  // The local adapter can never run next to live Clerk keys.
  const liveClerk = (read("CLERK_SECRET_KEY") ?? "").startsWith("sk_live_");
  if (explicit === "clerk") return clerkReady ? "clerk" : "unconfigured";
  if (explicit === "local") return localAllowed && !liveClerk ? "local" : "unconfigured";
  if (clerkReady) return "clerk";
  return localAllowed ? "local" : "unconfigured";
}

export function localAuthSecret(): string {
  const s = read("LOCAL_AUTH_SECRET");
  if (s && s.length >= 32) return s;
  if (isProduction()) throw new Error("LOCAL_AUTH_SECRET must be set (32+ characters) when the local auth adapter runs in production mode.");
  return "dev-only-insecure-secret-change-me-0000000000";
}

export type PaymentsProvider = "stripe" | "mock" | "unconfigured";
export function paymentsProvider(): PaymentsProvider {
  const explicit = read("PAYMENTS_PROVIDER");
  const key = read("STRIPE_SECRET_KEY");
  const mockAllowed = !isProduction() || read("LOCAL_AUTH_ALLOW_PRODUCTION") === "true";
  if (explicit === "mock") return mockAllowed ? "mock" : "unconfigured";
  if (key) {
    const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
    if (live && read("STRIPE_LIVE_MODE_ENABLED") !== "true") return "unconfigured";
    return read("STRIPE_WEBHOOK_SECRET") ? "stripe" : "unconfigured";
  }
  return mockAllowed ? "mock" : "unconfigured";
}
export const stripeSecretKey = () => read("STRIPE_SECRET_KEY");
// The mock provider signs its own events with a local secret so the webhook path is identical.
export const stripeWebhookSecret = () => read("STRIPE_WEBHOOK_SECRET") ?? (paymentsProvider() === "mock" ? "whsec_local_mock_" + localAuthSecret().slice(0, 24) : undefined);

export type AiProviderName = "anthropic" | "openai-compatible" | "none";
export function aiProviderName(): AiProviderName {
  const explicit = read("AI_PROVIDER");
  if (explicit === "none") return "none";
  if (explicit === "openai-compatible") return read("OPENAI_COMPATIBLE_BASE_URL") && read("AI_MODEL") ? "openai-compatible" : "none";
  if (read("ANTHROPIC_API_KEY")) return "anthropic";
  return read("OPENAI_COMPATIBLE_BASE_URL") && read("AI_MODEL") ? "openai-compatible" : "none";
}

export const config = {
  databaseUrl: () => read("DATABASE_URL"),
  databaseSsl: () => read("DATABASE_SSL"),
  clerkPublishableKey: () => read("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  clerkWebhookSecret: () => read("CLERK_WEBHOOK_SIGNING_SECRET"),
  storageDriver: () => (read("STORAGE_DRIVER") === "supabase" ? "supabase" : "local") as "supabase" | "local",
  storageLocalDir: () => read("STORAGE_LOCAL_DIR") ?? ".data/uploads",
  supabaseUrl: () => read("SUPABASE_URL"),
  supabaseServiceKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseBucket: () => read("SUPABASE_STORAGE_BUCKET") ?? "skillxgen-private",
  anthropicKey: () => read("ANTHROPIC_API_KEY"),
  aiModel: () => read("AI_MODEL"),
  openaiBaseUrl: () => read("OPENAI_COMPATIBLE_BASE_URL"),
  openaiKey: () => read("OPENAI_COMPATIBLE_API_KEY"),
  resendKey: () => read("RESEND_API_KEY"),
  emailFrom: () => read("EMAIL_FROM") ?? "SkillXGen <no-reply@example.com>",
  n8nWebhookUrl: () => read("N8N_WEBHOOK_URL"),
  n8nWebhookSecret: () => read("N8N_WEBHOOK_SECRET"),
  postizUrl: () => read("POSTIZ_API_URL"),
  postizKey: () => read("POSTIZ_API_KEY"),
  twentyUrl: () => read("TWENTY_API_URL"),
  umamiScript: () => read("NEXT_PUBLIC_UMAMI_SCRIPT_URL"),
  umamiWebsiteId: () => read("NEXT_PUBLIC_UMAMI_WEBSITE_ID"),
  calcomLink: () => read("NEXT_PUBLIC_CALCOM_LINK"),
};
