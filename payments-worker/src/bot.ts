/**
 * Telegram support bot – answers customers 24/7 in a warm, upbeat voice.
 *
 *   POST /telegram/webhook   (Telegram)  every message to the bot
 *
 * Setup (README → "Chat support bot"):
 *   1. Create a bot with @BotFather → token → `npx wrangler secret put TELEGRAM_BOT_TOKEN`
 *   2. Any random string → `npx wrangler secret put TELEGRAM_WEBHOOK_SECRET`
 *   3. Claude API key → `npx wrangler secret put ANTHROPIC_API_KEY`
 *   4. Point Telegram at the worker (once):
 *      https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>/telegram/webhook&secret_token=<SECRET>
 *   5. Optional: your own chat id in TELEGRAM_OWNER_CHAT_ID to get a ping when someone needs a human.
 *
 * Memory: only the last few messages of each chat are kept (for context), under a hashed chat id.
 */
import Anthropic from '@anthropic-ai/sdk';
import { firestore } from './firestore';
import { timingSafeEqual } from './crypto';

export interface BotEnv {
  FIREBASE_PROJECT_ID: string;
  GOOGLE_SERVICE_ACCOUNT: string;
  APP_URL: string;
  PRICE_DAY_USD: string;
  PRICE_MONTH_USD: string;
  PRICE_YEAR_USD: string;
  ANTHROPIC_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_OWNER_CHAT_ID?: string;
  /** Claude model for the bot (default claude-opus-5-5). */
  BOT_MODEL?: string;
}

const KEEP_MESSAGES = 10;
/** Per chat: at most this many replies per 10 minutes and per day (protects the Claude bill). */
const PER_10_MIN = 20;
const PER_DAY = 150;
const HANDOFF = '[[HUMAN]]';

function systemPrompt(env: BotEnv): string {
  return `You are Mia from the TableWise team, chatting with customers on Telegram. TableWise (${env.APP_URL}) gives live signals for casino tables: the player taps what came at their live table and TableWise shows the side and the exact amount for the next bet, fills their profit target live and tells them the moment to cash out.

How you sound: warm, upbeat, short – like a friendly person texting, 1–4 short sentences, an emoji now and then. Encourage people and keep the mood positive. Always end with a clear next step or link.

What you know:
- Games with signals: Baccarat, Craps, Roulette, Sic Bo – at any online or land-based casino. Dragon Tiger is on the free practice tables only.
- Session rules: target +5% of the amount, safety limit 10%, cash out once halfway there if half the best is given back, fresh table after 3 misses, 30-minute sessions, one a day.
- How to start: sign up at ${env.APP_URL}/signup (Google sign-in works) → 3 hours of full access free, no card. Then open the Signal Room, pick the game, enter today's amount, tap the last result, and follow the signals.
- The signals ride runs: when a side keeps coming, the signal goes with it; when the table swings, it swings with it. Bets step up and down on an 8-step ladder sized from the player's amount. After 3 misses in a row the coach says to hop to a fresh table. Every bet stays inside a safety limit, and the coach says when to cash out on top.
- Free practice tables with play money: ${env.APP_URL}/lobby
- Passes (pay once, never auto-renew): Day $${env.PRICE_DAY_USD}, Monthly $${env.PRICE_MONTH_USD} (most popular), Yearly $${env.PRICE_YEAR_USD} (best value). Pay by card (Visa, Mastercard, Apple Pay, Google Pay) or crypto at ${env.APP_URL}/pro – checkout opens in a new tab. The pass switches on by itself as soon as the payment arrives, usually within minutes. Tapping "I've paid" switches it on right away; if no payment arrives within 60 minutes it pauses and comes back by itself once it does. Card checkouts are handled by licensed partners who may ask for a quick ID check.
- Free hours are limited to 2 accounts per network.

Rules:
- Never promise or guarantee wins or income. You may say the signals give a clear plan for every bet and help people cash out on top.
- Players must be 18+ and play where it's legal. If someone seems to be struggling, chasing losses or playing with money they need, be kind, suggest a break (the account page has a pause option) and share https://www.begambleaware.org.
- Never ask for passwords, card numbers or wallet keys.
- If they sincerely ask whether you are a person or a bot, say honestly that you're TableWise's assistant.
- If they have a payment problem you can't solve from the facts above, a refund request, or they ask for a person: ask for the email on their account, tell them a teammate will follow up, and add ${HANDOFF} at the very end of your reply.
- Don't make up features, prices or policies that aren't listed here.`;
}

async function sha(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function tg(env: BotEnv, method: string, body: unknown) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Asks Claude for the reply. Returns null when it can't answer. */
async function answer(env: BotEnv, history: Anthropic.Beta.BetaMessageParam[]): Promise<string | null> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const res = await client.beta.messages.create({
      model: env.BOT_MODEL || 'claude-opus-5-5',
      max_tokens: 1024,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: systemPrompt(env), cache_control: { type: 'ephemeral' } }],
      messages: history,
    });
    if (res.stop_reason === 'refusal') return null;
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn('Bot rate limited');
    else if (e instanceof Anthropic.APIError) console.error('Bot API error', e.status, e.message);
    else console.error('Bot error', e);
    return null;
  }
}

export async function telegramWebhook(req: Request, env: BotEnv): Promise<{ ok: boolean }> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.ANTHROPIC_API_KEY) return { ok: false };
  if (!timingSafeEqual(req.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TELEGRAM_WEBHOOK_SECRET)) return { ok: false };

  const update: any = await req.json().catch(() => ({}));
  const msg = update.message;
  const text: string = typeof msg?.text === 'string' ? msg.text.slice(0, 2000) : '';
  const chatId = msg?.chat?.id;
  if (!chatId || msg.chat.type !== 'private') return { ok: true };

  if (!text) {
    await tg(env, 'sendMessage', { chat_id: chatId, text: 'Send me a message and I\'ll help right away 🙂' });
    return { ok: true };
  }

  const fs = firestore(env);
  const key = await sha(`tg|${chatId}`);
  const doc = await fs.get(`botChats/${key}`).catch(() => null);

  // Rate limit per chat.
  const now = Date.now();
  const win = typeof doc?.win === 'number' && now - doc.win < 600_000 ? doc.win : now;
  const n = (win === doc?.win && typeof doc?.n === 'number' ? doc.n : 0) + 1;
  const day = typeof doc?.day === 'number' && now - doc.day < 86_400_000 ? doc.day : now;
  const dn = (day === doc?.day && typeof doc?.dn === 'number' ? doc.dn : 0) + 1;
  const limits = { win, n, day, dn };
  if (n > PER_10_MIN || dn > PER_DAY) {
    if (n === PER_10_MIN + 1 || dn === PER_DAY + 1) {
      await tg(env, 'sendMessage', { chat_id: chatId, text: "You're quick! Give me a few minutes and I'll be right back 🙂" });
    }
    if (doc) await fs.update(`botChats/${key}`, limits).catch(() => {});
    return { ok: true };
  }

  await tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
  let history: Anthropic.Beta.BetaMessageParam[] = [];
  try {
    history = JSON.parse(String(doc?.history || '[]'));
  } catch {}
  const userText = text === '/start' ? 'Hi! I just found TableWise. How does it work?' : text;
  history.push({ role: 'user', content: userText });
  history = history.slice(-KEEP_MESSAGES);
  if (history[0]?.role !== 'user') history = history.slice(1);

  let reply = await answer(env, history);
  if (!reply) reply = `Sorry, I'm having a moment! You can start free right here: ${env.APP_URL}/signup – I'll be back in a sec 🙂`;

  const handoff = reply.includes(HANDOFF);
  reply = reply.replace(HANDOFF, '').trim();
  await tg(env, 'sendMessage', { chat_id: chatId, text: reply, disable_web_page_preview: true });

  history.push({ role: 'assistant', content: reply });
  const data = { history: JSON.stringify(history.slice(-KEEP_MESSAGES)), updatedAt: new Date(), ...limits };
  if (doc) await fs.update(`botChats/${key}`, data).catch(() => {});
  else await fs.create('botChats', key, data).catch(() => {});

  if (handoff && env.TELEGRAM_OWNER_CHAT_ID) {
    const who = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'A customer';
    await tg(env, 'sendMessage', {
      chat_id: env.TELEGRAM_OWNER_CHAT_ID,
      text: `🙋 ${who} needs a person.\nLast message: ${text.slice(0, 500)}`,
    });
  }
  return { ok: true };
}
