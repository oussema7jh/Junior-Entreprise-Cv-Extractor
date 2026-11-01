// S1-23 · The upload API and the job status API, against the running app and the local Supabase.
// Run: supabase start, npm run build && npm run start, then npm run test:api
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_BYTES, MAX_UPLOADS_PER_DAY } from "@/lib/cv/upload-rules";
import { admin, APP_URL, clientAs, createUser, deleteTestUsers, DOCX, getJob, PDF, upload } from "./helpers";

type User = Awaited<ReturnType<typeof createUser>>;
let alice: User, bob: User, company: User;

before(async () => {
  await fetch(APP_URL).catch(() => {
    throw new Error(`The app isn't running at ${APP_URL}: npm run build && npm run start`);
  });
  [alice, bob, company] = await Promise.all([createUser("candidate"), createUser("candidate"), createUser("company")]);
});
after(deleteTestUsers);

// ── refused, one case at a time ──────────────────────────────────────────
test("logged out → 401", async () => {
  const r = await upload(null);
  assert.equal(r.status, 401);
  assert.equal(r.body.error, "not_logged_in");
});

test("a company can't upload a CV → 403", async () => {
  const r = await upload(company.cookie);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, "not_candidate");
});

test("without consent → 400 with a message", async () => {
  const r = await upload(alice.cookie, { consent: null as unknown as string });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "no_consent");
  assert.match(r.body.message, /consent/i);
});

test("without looking_for → 400", async () => {
  const r = await upload(alice.cookie, { lookingFor: null });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "no_looking_for");
});

test("a Word file renamed .pdf → 415 'export it as PDF first'", async () => {
  const r = await upload(alice.cookie, { file: DOCX, name: "cv.pdf" });
  assert.equal(r.status, 415);
  assert.equal(r.body.error, "word_file");
  assert.match(r.body.message, /export it as PDF/i);
});

test("a file that isn't a PDF, JPG or PNG → 415", async () => {
  const r = await upload(alice.cookie, { file: new TextEncoder().encode("just text"), name: "cv.png" });
  assert.equal(r.status, 415);
  assert.equal(r.body.error, "bad_type");
});

test("over 5 MB → 413", async () => {
  const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
  big.set(PDF);
  const r = await upload(alice.cookie, { file: big });
  assert.equal(r.status, 413);
  assert.equal(r.body.error, "too_large");
});

test("none of the refused uploads left a job or a file", async () => {
  const { count } = await admin.from("extraction_jobs").select("*", { count: "exact", head: true }).eq("user_id", alice.id);
  assert.equal(count, 0);
  const { data } = await admin.storage.from("uploads-tmp").list(alice.id);
  assert.equal(data?.length ?? 0, 0);
});

// ── accepted ─────────────────────────────────────────────────────────────
test("a valid upload stores the file, creates the draft profile and a queued job", async () => {
  const r = await upload(alice.cookie, { lookingFor: "internship" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const { data: job } = await admin.from("extraction_jobs").select("*").eq("id", r.body.jobId).single();
  assert.equal(job.user_id, alice.id);
  assert.equal(job.kind, "extract");
  assert.equal(job.status, "queued");
  assert.ok(job.file_path.startsWith(`${alice.id}/`), job.file_path);

  const { data: file, error } = await admin.storage.from("uploads-tmp").download(job.file_path);
  assert.equal(error, null);
  assert.deepEqual(new Uint8Array(await file!.arrayBuffer()), PDF);

  const { data: profile } = await admin.from("profiles").select("status, looking_for").eq("user_id", alice.id).single();
  assert.deepEqual(profile, { status: "draft", looking_for: "internship" });
});

test("the bucket is private: even the owner can't read or list the file from the browser", async () => {
  const { data: job } = await admin.from("extraction_jobs").select("file_path").eq("user_id", alice.id).limit(1).single();
  const asAlice = await clientAs(alice);
  const { data: file } = await asAlice.storage.from("uploads-tmp").download(job!.file_path);
  assert.equal(file, null);
  const { data: listed } = await asAlice.storage.from("uploads-tmp").list(alice.id);
  assert.equal(listed?.length ?? 0, 0);
  const anonymous = await fetch(admin.storage.from("uploads-tmp").getPublicUrl(job!.file_path).data.publicUrl);
  assert.notEqual(anonymous.status, 200);
});

test(`the ${MAX_UPLOADS_PER_DAY + 1}th upload of the day → 429`, async () => {
  const { count } = await admin.from("extraction_jobs").select("*", { count: "exact", head: true }).eq("user_id", alice.id);
  const missing = MAX_UPLOADS_PER_DAY - (count ?? 0);
  await admin.from("extraction_jobs").insert(Array.from({ length: missing }, () => ({ user_id: alice.id, kind: "extract", status: "done" })));
  const r = await upload(alice.cookie);
  assert.equal(r.status, 429);
  assert.equal(r.body.error, "daily_limit");
});

test("yesterday's uploads don't count", async () => {
  const yesterday = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  await admin.from("extraction_jobs").update({ created_at: yesterday }).eq("user_id", alice.id);
  const r = await upload(alice.cookie);
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

// ── the job status ───────────────────────────────────────────────────────
test("the owner sees the job's status and queue position", async () => {
  const first = await upload(bob.cookie);
  const second = await upload(bob.cookie);
  const a = await getJob(bob.cookie, first.body.jobId);
  const b = await getJob(bob.cookie, second.body.jobId);
  assert.equal(a.status, 200);
  assert.equal(a.body.status, "queued");
  assert.equal(b.body.position, a.body.position + 1);
  assert.ok(a.body.position >= 1);
});

test("a failed job gives the worker's reason as a code the screen translates, and no position", async () => {
  // The exact sentence the worker writes (worker/cv_worker/jobs.py, FAILED_TO_READ).
  const { data: job } = await admin.from("extraction_jobs")
    .insert({ user_id: bob.id, kind: "extract", status: "failed", error_message: "We couldn't read this file. Try a PDF export of your CV." })
    .select("id").single();
  const r = await getJob(bob.cookie, job!.id);
  assert.deepEqual(r.body, { status: "failed", position: null, error: "failed_to_read" });
});

test("another candidate asking for that job id gets a 404", async () => {
  const { data: job } = await admin.from("extraction_jobs").select("id").eq("user_id", bob.id).limit(1).single();
  const r = await getJob(alice.cookie, job!.id);
  assert.equal(r.status, 404);
});

test("logged out → 401, and a made-up id → 404", async () => {
  const { data: job } = await admin.from("extraction_jobs").select("id").eq("user_id", bob.id).limit(1).single();
  assert.equal((await getJob(null, job!.id)).status, 401);
  assert.equal((await getJob(bob.cookie, "not-a-uuid")).status, 404);
  assert.equal((await getJob(bob.cookie, "00000000-0000-4000-8000-000000000000")).status, 404);
});
