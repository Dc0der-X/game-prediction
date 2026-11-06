/**
 * PayGate.to – card (Visa / Mastercard / Apple Pay / Google Pay, paid out in USDC on Polygon)
 * and crypto (BTC, ETH, USDT, USDC … on many networks) with instant payouts to OUR wallets.
 * No account and no API key: we pass our own payout wallet addresses with each request.
 *
 * Docs: https://paygate.to/docs/ (payment-gateway-api, crypto-payment-api).
 *
 * Every callback PayGate sends is signed (RSA-2048, SHA-256, PKCS#1 v1.5) over the exact URL it
 * requested: our registered callback URL + the raw query string. We verify it and fail closed.
 */

/** PayGate's published callback key (https://paygate.to/docs/paygate_callback_public.pem), id "v1". */
const PAYGATE_KEYS: Record<string, string> = {
  v1: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsSTZxO5ze2B2QdkfYUuI
1KgBKcwuKfYq35ktaJFH0m3EfUQhn+6qgTsYHedF/49uFm6UP20tm3/mhwVfcTIa
vdfZhBtcQhyRAa4RDvHlrobZ0y/no99uPqOMLwOCgSRE6LPOpz2hOBM0/p1MX9UV
NiR7XuWDP+JPWEaI0agBK0hEzaEC1foyHv+QgjrM4Mt/1oXl0PDFbP5hVIg6rc7j
q8c4+cyC/iEPWraWnFipBDHA01svSkUoAB8WxlFDwaJ2dh5k1hRlYH2fbZOaGqIh
g1Vxb9qrSEEAZh/PxAtK7NkksvxyPa5eRQpCAyO7LJ2xKOuZ8iFJnI4+iJ76IHRR
TwIDAQAB
-----END PUBLIC KEY-----`,
};

export interface PayGateEnv {
  /** Our EVM wallet (USDC on Polygon for card payouts; also receives ETH/USDT/USDC on EVM chains). */
  PAYGATE_WALLET?: string;
  /** Optional extra crypto wallets for the crypto checkout. */
  PAYGATE_BTC?: string;
  PAYGATE_TRC20?: string;
  PAYGATE_SOLANA?: string;
  /** Optional dedicated endpoints (free from PayGate); defaults to the shared ones. */
  PAYGATE_API?: string;
  PAYGATE_CHECKOUT?: string;
  /** Tests only: a different callback key, as PEM. */
  PAYGATE_TEST_KEY_PEM?: string;
}

export const api = (env: PayGateEnv) => (env.PAYGATE_API || 'https://api.paygate.to').replace(/\/$/, '');
export const checkoutHost = (env: PayGateEnv) => (env.PAYGATE_CHECKOUT || 'https://checkout.paygate.to').replace(/\/$/, '');

export const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/* ---------- Signature ---------- */

const keyCache = new Map<string, Promise<CryptoKey>>();

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function publicKey(env: PayGateEnv, keyId: string): Promise<CryptoKey> | null {
  const pem = env.PAYGATE_TEST_KEY_PEM || PAYGATE_KEYS[keyId];
  if (!pem) return null;
  const cacheKey = `${keyId}|${pem.length}|${pem.slice(-40)}`;
  if (!keyCache.has(cacheKey)) {
    keyCache.set(cacheKey, crypto.subtle.importKey('spki', pemToDer(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  }
  return keyCache.get(cacheKey)!;
}

/** True only for a callback PayGate really sent for exactly this URL. */
export async function verifyCallback(env: PayGateEnv, signedUrl: string, signatureB64: string | null, keyId: string | null): Promise<boolean> {
  if (!signatureB64) return false;
  const key = publicKey(env, keyId || 'v1');
  if (!key) {
    console.error('PayGate callback signed with an unknown key id:', keyId);
    return false;
  }
  let sig: Uint8Array;
  try {
    const bin = atob(signatureB64.trim());
    sig = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) sig[i] = bin.charCodeAt(i);
  } catch {
    return false;
  }
  try {
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await key, sig, new TextEncoder().encode(signedUrl));
  } catch {
    return false;
  }
}

/* ---------- Checkout links ---------- */

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(`PayGate ${res.status} for ${url.split('?')[0]}`);
  return data;
}

/** Card checkout: a one-off receiving wallet + the hosted page where the buyer picks a card provider. */
export async function cardCheckout(env: PayGateEnv, callbackUrl: string, amountUsd: number, email: string) {
  const wallet = await getJson(
    `${api(env)}/control/wallet.php?address=${encodeURIComponent(env.PAYGATE_WALLET!)}&callback=${encodeURIComponent(callbackUrl)}`
  );
  const addressIn = String(wallet.address_in || '');
  const polygonIn = String(wallet.polygon_address_in || '');
  // address_in is returned already URL-encoded: pass it on exactly as received.
  if (!addressIn || !/^[A-Za-z0-9%._~-]+$/.test(addressIn) || !EVM_RE.test(polygonIn)) throw new Error('PayGate wallet response not understood');
  const url =
    `${checkoutHost(env)}/pay.php?address=${addressIn}` +
    `&amount=${amountUsd.toFixed(2)}&email=${encodeURIComponent(email)}&currency=USD`;
  return { url, addressIn: polygonIn.toLowerCase(), ipnToken: String(wallet.ipn_token || '') };
}

/** Crypto checkout: the hosted multi-coin page (buyer picks the coin; the amount is locked by PayGate). */
export async function cryptoCheckout(env: PayGateEnv, callbackUrl: string, amountUsd: number) {
  const body: Record<string, string | number> = {
    evm: env.PAYGATE_WALLET!,
    fiat_amount: Number(amountUsd.toFixed(2)),
    fiat_currency: 'USD',
    callback: callbackUrl,
  };
  if (env.PAYGATE_BTC) body.btc = env.PAYGATE_BTC;
  if (env.PAYGATE_TRC20) body.trc20 = env.PAYGATE_TRC20;
  if (env.PAYGATE_SOLANA) body.solana = env.PAYGATE_SOLANA;
  const data = await getJson(`${api(env)}/crypto/multi-hosted-wallet.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const token = String(data.payment_token || '');
  if (!token || !/^[A-Za-z0-9%._~-]+$/.test(token)) throw new Error('PayGate hosted wallet response not understood');
  return { url: `${checkoutHost(env)}/crypto/hosted.php?payment_token=${token}&add_fees=1`, ipnToken: String(data.ipn_token || '') };
}

/* ---------- Amount checks ---------- */

const STABLE = /(^|_)(usdc|usdt|dai|pyusd|fdusd|usde|busd|tusd)$/;

/**
 * USD value of what was paid. Stablecoins count 1:1; other coins are converted with PayGate's
 * own rate for the plan price (so the check is "paid at least X% of what the plan costs in that coin").
 * Returns null when the coin can't be priced.
 */
export async function usdValue(env: PayGateEnv, coin: string, valueCoin: number, priceUsd: number): Promise<number | null> {
  if (!(valueCoin > 0)) return 0;
  if (STABLE.test(coin)) return valueCoin;
  if (!/^[a-z0-9]+(_[a-z0-9]+)?$/.test(coin)) return null;
  const ticker = coin.replace('_', '/');
  try {
    const r = await getJson(`${api(env)}/crypto/${ticker}/convert.php?from=usd&value=${priceUsd.toFixed(2)}`);
    const expected = Number(r.value_coin);
    if (r.status !== 'success' || !(expected > 0)) return null;
    return (valueCoin / expected) * priceUsd;
  } catch {
    return null;
  }
}
