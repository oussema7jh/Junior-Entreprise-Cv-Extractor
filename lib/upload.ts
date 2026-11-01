// S1-28 · The upload page's browser side: instant feedback on the file, then POST /api/cv/upload (S1-23).
// These checks are politeness only: the server checks everything again, from the file's real bytes.
// The limits come from the server's own rules, so the two can never disagree.
import { LOOKING_FOR, MAX_UPLOAD_BYTES } from "@/lib/cv/upload-rules";

export const MAX_CV_BYTES = MAX_UPLOAD_BYTES;
export const CV_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export { LOOKING_FOR };
export type LookingFor = (typeof LOOKING_FOR)[number];
// Problems the page finds itself, before anything is sent (texts: messages/ → upload.errors).
export type UploadError =
  | "wrongType" | "tooBig" | "emptyFile" | "multipleFiles" | "noFile"
  | "noChoice" | "noConsent" | "network" | "failed";

// A refused upload. serverMessage is the server's sentence for it, already in the visitor's
// language (S1-14); code is the server's code (e.g. "word_file") or one of ours.
export class UploadFailure extends Error {
  constructor(public code: string, public serverMessage: string | null) {
    super(code);
  }
}

export function validateCvFile(file: Pick<File, "name" | "type" | "size">): UploadError | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expectedType: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  };
  if (!extension || !expectedType[extension] || (file.type && file.type !== expectedType[extension])) {
    return "wrongType";
  }
  if (file.size > MAX_CV_BYTES) return "tooBig";
  if (file.size === 0) return "emptyFile";
  return null;
}

export async function uploadCv(file: File, lookingFor: LookingFor, consent: boolean): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("looking_for", lookingFor);
  form.set("consent", String(consent));
  let response: Response;
  try {
    response = await fetch("/api/cv/upload", {
      method: "POST", body: form, credentials: "same-origin",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new UploadFailure("network", null);
  }
  const body: unknown = await response.json().catch(() => null);
  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    // S1-23 answers every refusal with { error, message }. Anything else stays generic.
    const known = typeof fields.error === "string" && typeof fields.message === "string";
    throw new UploadFailure(known ? (fields.error as string) : "failed", known ? (fields.message as string) : null);
  }
  if (typeof fields.jobId !== "string" || !fields.jobId) throw new UploadFailure("failed", null);
  return fields.jobId;
}
