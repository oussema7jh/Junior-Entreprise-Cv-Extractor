// S1-23 · POST /api/cv/upload — the door CVs come through.
// Every check happens here, on the server: a check in the browser can be skipped by calling this URL
// directly. The rules themselves are in lib/cv/upload-rules.ts.
// On success: the file is in the private bucket uploads-tmp, the candidate's profile row exists,
// and a "queued" extract job waits for the Python worker (S1-24). Returns 201 { jobId }.
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUpload, MAX_UPLOAD_BYTES, MIME_TYPES, type UploadError } from "@/lib/cv/upload-rules";
import { getTranslations } from "next-intl/server";

// The message is in the visitor's language (S1-14: their EN/FR choice, else their browser's).
const fail = async (status: number, code: UploadError | "upload_failed") => {
  const t = await getTranslations("upload.errors");
  return Response.json({ error: code, message: t(code) }, { status });
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  // Don't even read a body that announces itself as far too big (the form adds a little overhead).
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) {
    return fail(user ? 413 : 401, user ? "too_large" : "not_logged_in");
  }

  const form = await request.formData().catch(() => null);
  const entry = form?.get("file");
  const file = entry instanceof File ? entry : null;
  const admin = createAdminClient();

  // Only a confirmed candidate costs a database call for the daily count.
  let uploadsToday = 0;
  if (user?.role === "candidate" && user.emailConfirmed) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error } = await admin
      .from("extraction_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "extract")
      .gte("created_at", since);
    if (error) return fail(500, "upload_failed");
    uploadsToday = count ?? 0;
  }

  const check = checkUpload({
    user,
    file: file && { size: file.size, head: new Uint8Array(await file.slice(0, 16).arrayBuffer()) },
    consent: form?.get("consent") === "true",
    lookingFor: (form?.get("looking_for") as string | null) ?? null,
    uploadsToday,
  });
  if (!check.ok) return fail(check.status, check.code);

  // From here the user is a confirmed candidate and the file is valid.
  const userId = user!.id;
  const lookingFor = form!.get("looking_for") as string;
  const path = `${userId}/${randomUUID()}.${check.type === "jpeg" ? "jpg" : check.type}`;

  const stored = await admin.storage
    .from("uploads-tmp")
    .upload(path, await file!.arrayBuffer(), { contentType: MIME_TYPES[check.type] });
  if (stored.error) return fail(500, "upload_failed");

  // The profile row stays as it is if it exists (an approved profile stays visible, design §10a.4);
  // only looking_for follows the candidate's latest choice.
  const profile = await admin
    .from("profiles")
    .upsert({ user_id: userId, looking_for: lookingFor }, { onConflict: "user_id" });
  const job = profile.error
    ? null
    : await admin
        .from("extraction_jobs")
        .insert({ user_id: userId, kind: "extract", file_path: path })
        .select("id")
        .single();

  if (!job || job.error) {
    await admin.storage.from("uploads-tmp").remove([path]); // never keep a CV nobody will process
    return fail(500, "upload_failed");
  }
  return Response.json({ jobId: job.data.id }, { status: 201 });
}
