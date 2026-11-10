// Upload validation: size limits, extension allow-list and magic-byte sniffing (never trust the client MIME type).
export type UploadKind = "document" | "asset";
export type ValidatedUpload = { buffer: Buffer; mime: string; ext: string; name: string };

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_BYTES = 8 * 1024 * 1024;

const startsWith = (b: Buffer, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

function sniff(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    // DOCX is a zip archive that must contain the main document part.
    const haystack = buffer.toString("latin1");
    if (haystack.includes("word/document.xml") && haystack.includes("[Content_Types].xml")) {
      return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" };
    }
    return null;
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

const ALLOWED: Record<UploadKind, string[]> = {
  document: ["pdf", "docx"],
  asset: ["pdf", "docx", "png", "jpg", "webp"],
};

export class UploadError extends Error {}

export async function validateUpload(file: File | null | undefined, kind: UploadKind): Promise<ValidatedUpload> {
  if (!file || typeof file === "string" || file.size === 0) throw new UploadError("Choose a file to upload.");
  const max = kind === "document" ? MAX_DOCUMENT_BYTES : MAX_ASSET_BYTES;
  if (file.size > max) throw new UploadError(`File is too large. The limit is ${Math.round(max / 1024 / 1024)} MB.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = sniff(buffer);
  const declaredExt = (file.name.split(".").pop() ?? "").toLowerCase().replace("jpeg", "jpg");
  if (!detected || !ALLOWED[kind].includes(detected.ext)) {
    throw new UploadError(kind === "document" ? "Only PDF and DOCX files are accepted." : "Only PDF, DOCX, PNG, JPG and WEBP files are accepted.");
  }
  if (declaredExt !== detected.ext) throw new UploadError("The file extension does not match the file contents.");
  const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || `upload.${detected.ext}`;
  return { buffer, mime: detected.mime, ext: detected.ext, name };
}
