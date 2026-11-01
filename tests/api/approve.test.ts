// S1-32 · Approval and the QR page, against the running app and the local Supabase.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import example from "../fixtures/example-profile.json";
import { admin, APP_URL, clientAs, createUser, deleteTestUsers } from "./helpers";

// Whatever JSON.parse returns: the tests break the fixture on purpose, so no type can describe it.
type Loose = ReturnType<typeof JSON.parse>;

type User = Awaited<ReturnType<typeof createUser>>;
let company: User;

before(async () => {
  company = await createUser("company");
});
after(deleteTestUsers);

// A candidate whose CV was extracted: a draft profile row and a draft waiting for review.
async function candidateWithDraft(change: (d: Loose) => void = () => {}) {
  const user = await createUser("candidate");
  const data: Loose = structuredClone(example);
  change(data);
  await admin.from("profiles").insert({ user_id: user.id, looking_for: "internship" });
  const { data: draft } = await admin.from("profile_drafts")
    .insert({ user_id: user.id, data, provider: "gemini" }).select("updated_at").single();
  return { ...user, updatedAt: draft!.updated_at as string };
}

async function approve(cookie: string | null, body: unknown) {
  const response = await fetch(`${APP_URL}/api/profile/approve`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const profileOf = async (id: string) =>
  (await admin.from("profiles").select("*").eq("user_id", id).single()).data;
const draftOf = async (id: string) =>
  (await admin.from("profile_drafts").select("user_id").eq("user_id", id).maybeSingle()).data;
const embedJobs = async (id: string) =>
  (await admin.from("extraction_jobs").select("status").eq("user_id", id).eq("kind", "embed")).data ?? [];

// ── refused ──────────────────────────────────────────────────────────────
test("logged out → 401, a company → 403", async () => {
  assert.equal((await approve(null, { updated_at: "x" })).status, 401);
  assert.equal((await approve(company.cookie, { updated_at: "x" })).status, 403);
});

test("without updated_at → 400", async () => {
  const c = await candidateWithDraft();
  assert.equal((await approve(c.cookie, {})).status, 400);
});

test("no draft to approve → 404", async () => {
  const c = await createUser("candidate");
  assert.equal((await approve(c.cookie, { updated_at: new Date().toISOString() })).status, 404);
});

test("a draft that changed since the form loaded it → 409, nothing approved", async () => {
  const c = await candidateWithDraft();
  const r = await approve(c.cookie, { updated_at: "2020-01-01T00:00:00+00:00" });
  assert.equal(r.status, 409);
  assert.equal(r.body.error, "conflict");
  assert.equal((await profileOf(c.id)).status, "draft");
  assert.ok(await draftOf(c.id));
});

test("a draft that breaks the schema → 422 with the fields, nothing approved", async () => {
  const c = await candidateWithDraft((d) => { d.classification.domain = "astrology"; });
  const r = await approve(c.cookie, { updated_at: c.updatedAt });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.fields, ["classification.domain"]);
  assert.equal((await profileOf(c.id)).status, "draft");
});

test("a draft without an email → 422", async () => {
  const c = await candidateWithDraft((d) => { d.basics.email = null; });
  const r = await approve(c.cookie, { updated_at: c.updatedAt });
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.fields, ["basics.email"]);
});

test("a candidate can't approve by calling the database function directly", async () => {
  const c = await candidateWithDraft();
  const asCandidate = await clientAs(c);
  const { error } = await asCandidate.rpc("approve_profile", {
    p_user_id: c.id, p_data: { anything: "I want" }, p_draft_updated_at: c.updatedAt,
  });
  assert.ok(error, "the call must be refused");
  assert.equal((await profileOf(c.id)).status, "draft");
});

// ── approved ─────────────────────────────────────────────────────────────
test("approving copies the draft, keeps looking_for, deletes the draft and queues an embedding", async () => {
  const c = await candidateWithDraft();
  const r = await approve(c.cookie, { updated_at: c.updatedAt });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { redirect: "/candidate/approved" });

  const profile = await profileOf(c.id);
  assert.equal(profile.status, "approved");
  assert.ok(profile.approved_at);
  assert.match(profile.public_id, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(profile.data.basics.name, example.basics.name);
  assert.equal(profile.data.looking_for, "internship"); // the candidate's choice, not the AI's
  assert.equal(await draftOf(c.id), null);
  assert.deepEqual(await embedJobs(c.id), [{ status: "queued" }]);
});

test("approving twice with the same draft does nothing the second time", async () => {
  const c = await candidateWithDraft();
  assert.equal((await approve(c.cookie, { updated_at: c.updatedAt })).status, 200);
  assert.equal((await approve(c.cookie, { updated_at: c.updatedAt })).status, 404);
  assert.equal((await embedJobs(c.id)).length, 1);
});

test("the approved page shows a QR code that scans to /p/<public_id>, and a named download", async () => {
  const c = await candidateWithDraft();
  await approve(c.cookie, { updated_at: c.updatedAt });
  const { public_id } = await profileOf(c.id);

  const html = await (await fetch(`${APP_URL}/candidate/approved`, { headers: { cookie: c.cookie } })).text();
  const src = html.match(/src="data:image\/png;base64,([^"]+)"/)?.[1];
  assert.ok(src, "no QR image on the page");
  const png = PNG.sync.read(Buffer.from(src, "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, `${process.env.APP_URL ?? "http://127.0.0.1:3000"}/p/${public_id}`);
  assert.match(html, /download="qr-sarra-ben-ali\.png"/);
  assert.doesNotMatch(decoded!.data, /sarra|@/i); // the QR holds no name, no email
});

test("the approved page for a profile that isn't approved yet shows no QR code", async () => {
  const c = await candidateWithDraft();
  const html = await (await fetch(`${APP_URL}/candidate/approved`, { headers: { cookie: c.cookie } })).text();
  assert.doesNotMatch(html, /data:image\/png/);
});
