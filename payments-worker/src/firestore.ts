/**
 * Minimal Firestore REST client authenticated with a service account.
 * (firebase-admin does not run on Cloudflare Workers.)
 */
import { SignJWT, importPKCS8 } from 'jose';

export type FieldValue = string | number | boolean | null | Date;
export type Fields = Record<string, FieldValue>;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let cachedToken: { value: string; exp: number } | null = null;

async function googleAccessToken(saJson: string): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const sa: ServiceAccount = JSON.parse(saJson);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  cachedToken = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export function encode(v: FieldValue): any {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  return { doubleValue: v };
}

export function decode(v: any): any {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  return undefined;
}

export function firestore(env: { FIREBASE_PROJECT_ID: string; GOOGLE_SERVICE_ACCOUNT: string }) {
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const headers = async () => ({
    Authorization: `Bearer ${await googleAccessToken(env.GOOGLE_SERVICE_ACCOUNT)}`,
    'Content-Type': 'application/json',
  });
  const toFields = (data: Fields) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));

  return {
    /** Returns the document's fields, or null if it doesn't exist. */
    async get(path: string): Promise<Record<string, any> | null> {
      const res = await fetch(`${base}/${path}`, { headers: await headers() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Firestore get ${path}: ${res.status} ${await res.text()}`);
      const doc: any = await res.json();
      return Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decode(v)]));
    },

    /** Updates the given fields of an existing document (fails if it doesn't exist). */
    async update(path: string, data: Fields) {
      const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const res = await fetch(`${base}/${path}?${mask}&currentDocument.exists=true`, {
        method: 'PATCH',
        headers: await headers(),
        body: JSON.stringify({ fields: toFields(data) }),
      });
      if (!res.ok) throw new Error(`Firestore update ${path}: ${res.status} ${await res.text()}`);
    },

    /** Creates a document with a fixed id. Returns false if it already exists. */
    async create(collection: string, id: string, data: Fields): Promise<boolean> {
      const res = await fetch(`${base}/${collection}?documentId=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({ fields: toFields(data) }),
      });
      if (res.status === 409) return false;
      if (!res.ok) throw new Error(`Firestore create ${collection}/${id}: ${res.status} ${await res.text()}`);
      return true;
    },
  };
}
