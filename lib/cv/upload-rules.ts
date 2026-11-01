// S1-23 · The rules a CV upload must pass, checked on the server before it costs any AI quota.
// Pure functions: no database, no request. The API route (app/api/cv/upload/route.ts) feeds them.
// Tests: tests/unit/upload-rules.test.ts.
import type { Role } from "@/lib/auth";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Protects the free AI quota from someone uploading 1,000 files. Counted over the last 24 hours.
export const MAX_UPLOADS_PER_DAY = 5;
export const LOOKING_FOR = ["pfe", "internship", "job"] as const;

export type FileType = "pdf" | "jpeg" | "png";
export const MIME_TYPES: Record<FileType, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
};

export type UploadError =
  | "not_logged_in"
  | "email_not_confirmed"
  | "not_candidate"
  | "no_consent"
  | "no_looking_for"
  | "no_file"
  | "too_large"
  | "word_file"
  | "bad_type"
  | "daily_limit";

const startsWith = (head: Uint8Array, magic: number[]) => magic.every((b, i) => head[i] === b);

// The real type, read from the file's first bytes (its "magic number"). The name and the type the
// browser sends can say anything: renaming cv.docx to cv.pdf changes neither.
export function detectFileType(head: Uint8Array): FileType | "word" | "unknown" {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // "%PDF-"
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "word"; // .docx (a zip file)
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "word"; // old .doc
  return "unknown";
}

export type UploadInput = {
  user: { id: string; role: Role | null; emailConfirmed: boolean } | null;
  file: { size: number; head: Uint8Array } | null;
  consent: boolean;
  lookingFor: string | null;
  uploadsToday: number;
};

export type UploadCheck = { ok: true; type: FileType } | { ok: false; status: number; code: UploadError };

const refuse = (status: number, code: UploadError): UploadCheck => ({ ok: false, status, code });

export function checkUpload({ user, file, consent, lookingFor, uploadsToday }: UploadInput): UploadCheck {
  if (!user) return refuse(401, "not_logged_in");
  if (!user.emailConfirmed) return refuse(403, "email_not_confirmed");
  if (user.role !== "candidate") return refuse(403, "not_candidate");
  if (!consent) return refuse(400, "no_consent");
  if (!LOOKING_FOR.includes(lookingFor as (typeof LOOKING_FOR)[number])) return refuse(400, "no_looking_for");
  if (!file || file.size === 0) return refuse(400, "no_file");
  if (file.size > MAX_UPLOAD_BYTES) return refuse(413, "too_large");
  const type = detectFileType(file.head);
  if (type === "word") return refuse(415, "word_file");
  if (type === "unknown") return refuse(415, "bad_type");
  if (uploadsToday >= MAX_UPLOADS_PER_DAY) return refuse(429, "daily_limit");
  return { ok: true, type };
}
