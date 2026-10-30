export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const LOOKING_FOR = ["pfe", "internship", "job"] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];
export type UploadError =
  | "wrongType" | "tooBig" | "emptyFile" | "multipleFiles" | "noFile"
  | "noChoice" | "noConsent" | "dailyLimit" | "unauthorized"
  | "unavailable" | "network" | "failed";

// Browser feedback only. S1-23 must validate the actual file contents on the server.
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

export function uploadStatusError(status: number): UploadError {
  if (status === 413) return "tooBig";
  if (status === 415) return "wrongType";
  if (status === 429) return "dailyLimit";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404 || status === 503) return "unavailable";
  return "failed";
}

export function getJobId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("job_id" in body)) return null;
  const id = body.job_id;
  return typeof id === "string" && id.trim() && id.length <= 200 ? id : null;
}

export async function uploadCv(file: File, lookingFor: LookingFor, consent: boolean): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("looking_for", lookingFor);
  form.set("consent", String(consent));
  let response: Response;
  try {
    response = await fetch("/api/candidate/upload", {
      method: "POST", body: form, credentials: "same-origin",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("network" satisfies UploadError);
  }
  if (!response.ok) throw new Error(uploadStatusError(response.status));
  const body: unknown = await response.json().catch(() => null);
  const jobId = getJobId(body);
  if (!jobId) throw new Error("failed" satisfies UploadError);
  return jobId;
}
