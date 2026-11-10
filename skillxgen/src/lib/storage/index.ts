import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "../env";
import { withUser, service, type Identity } from "../db";
import type { ValidatedUpload } from "../uploads";

export type Bucket = "resumes" | "submissions" | "assets";

// Storage keys are generated server-side (bucket/uuid.ext): user-supplied names never reach the filesystem
// or object path, which rules out path traversal. Files are private; downloads go through /api/files/[id].
interface Driver {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const localDriver: Driver = {
  async put(key, data) {
    const full = path.join(/* turbopackIgnore: true */ process.cwd(), config.storageLocalDir(), key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { mode: 0o600 });
  },
  get: (key) => readFile(path.join(/* turbopackIgnore: true */ process.cwd(), config.storageLocalDir(), key)),
  async remove(key) {
    await unlink(path.join(/* turbopackIgnore: true */ process.cwd(), config.storageLocalDir(), key)).catch(() => {});
  },
};

function supabaseDriver(): Driver {
  const base = `${config.supabaseUrl()}/storage/v1/object/${config.supabaseBucket()}`;
  const auth = { Authorization: `Bearer ${config.supabaseServiceKey()}`, apikey: config.supabaseServiceKey()! };
  return {
    async put(key, data, mime) {
      const res = await fetch(`${base}/${key}`, { method: "POST", headers: { ...auth, "Content-Type": mime, "x-upsert": "false" }, body: new Uint8Array(data) });
      if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status})`);
    },
    async get(key) {
      const res = await fetch(`${base}/${key}`, { headers: auth });
      if (!res.ok) throw new Error(`Supabase Storage download failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(key) {
      await fetch(`${base}/${key}`, { method: "DELETE", headers: auth }).catch(() => {});
    },
  };
}

export function storageReady() {
  return config.storageDriver() === "local" || (!!config.supabaseUrl() && !!config.supabaseServiceKey());
}
const driver = (): Driver => (config.storageDriver() === "supabase" ? supabaseDriver() : localDriver);

export async function storeFile(owner: Identity, bucket: Bucket, upload: ValidatedUpload): Promise<{ id: string }> {
  const key = `${bucket}/${randomUUID()}.${upload.ext}`;
  await driver().put(key, upload.buffer, upload.mime);
  try {
    const [row] = await withUser(owner, (sql) => sql`
      insert into files (owner_id, bucket, storage_key, original_name, mime_type, size_bytes, sha256)
      values (${owner!.id}, ${bucket}, ${key}, ${upload.name}, ${upload.mime}, ${upload.buffer.length}, ${createHash("sha256").update(upload.buffer).digest("hex")})
      returning id`);
    return { id: row.id };
  } catch (e) {
    await driver().remove(key);
    throw e;
  }
}

/** Reads a file the caller is allowed to see (RLS decides). Returns null when not visible. */
export async function readFileFor(viewer: Identity, fileId: string) {
  const [meta] = await withUser(viewer, (sql) => sql`select storage_key, original_name, mime_type from files where id = ${fileId}`);
  if (!meta) return null;
  return { data: await driver().get(meta.storage_key), name: meta.original_name as string, mime: meta.mime_type as string };
}

export async function deleteFilesOfUser(userId: string) {
  const rows = await service()`delete from files where owner_id = ${userId} returning storage_key`;
  await Promise.all(rows.map((r) => driver().remove(r.storage_key)));
  return rows.length;
}
