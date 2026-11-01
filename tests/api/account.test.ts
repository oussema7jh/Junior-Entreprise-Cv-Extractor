// S2-16 · Re-uploading over an approved profile, and deleting an account, against the running app
// and the local Supabase. The deletion is checked with SQL (leftover_rows), not by trusting the cascade.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import example from "../fixtures/example-profile.json";
import { admin, APP_URL, clientAs, createUser, deleteTestUsers, upload } from "./helpers";

type User = Awaited<ReturnType<typeof createUser>>;
let company: User;

before(async () => {
  company = await createUser("company");
  assert.ifError((await admin.from("companies").insert({ user_id: company.id, name: "Account Test Co" })).error);
});
after(deleteTestUsers);

// A candidate whose profile is approved and visible to companies.
async function approvedCandidate() {
  const user = await createUser("candidate");
  const profile = await admin.from("profiles").insert({ user_id: user.id, status: "approved", looking_for: "pfe",
    data: { ...example, looking_for: "pfe" }, approved_at: new Date().toISOString() });
  assert.ifError(profile.error);
  return user;
}

async function deleteAccount(cookie: string | null, body: unknown) {
  const response = await fetch(`${APP_URL}/api/candidate/delete`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function leftovers(userId: string) {
  const { data, error } = await admin.rpc("leftover_rows", { p_user_id: userId });
  assert.ifError(error);
  return Object.fromEntries((data as { table_name: string; row_count: number }[]).map((r) => [r.table_name, Number(r.row_count)]));
}

const filesOf = async (userId: string) => (await admin.storage.from("uploads-tmp").list(userId)).data ?? [];

// ── re-upload ────────────────────────────────────────────────────────────
test("during re-review, companies still see the old approved version", async () => {
  const c = await approvedCandidate();
  const r = await upload(c.cookie, { lookingFor: "job" });
  assert.equal(r.status, 201, JSON.stringify(r.body));

  // What a company reads, with its own login and every access rule.
  const seen = await (await clientAs(company)).from("profiles").select("status, looking_for, data").eq("user_id", c.id).single();
  assert.ifError(seen.error);
  assert.equal(seen.data.status, "approved");
  assert.equal(seen.data.looking_for, "pfe", "the new choice isn't live before approval");
  assert.equal(seen.data.data.basics.name, example.basics.name);

  // The new choice waits with the job, for the worker to put in the draft.
  const { data: job } = await admin.from("extraction_jobs").select("looking_for").eq("id", r.body.jobId).single();
  assert.equal(job!.looking_for, "job");
});

test("approving the new draft replaces the live data and its looking_for, and re-embeds", async () => {
  const c = await approvedCandidate();
  // What the worker saves after the re-upload: the new CV, with the choice made at upload.
  const { data: draft } = await admin.from("profile_drafts")
    .insert({ user_id: c.id, data: { ...example, basics: { ...example.basics, headline: "Now a graduate" }, looking_for: "job" }, provider: "gemini" })
    .select("updated_at").single();

  const response = await fetch(`${APP_URL}/api/profile/approve`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: c.cookie },
    body: JSON.stringify({ updated_at: draft!.updated_at }),
  });
  assert.equal(response.status, 200, await response.text());

  const { data: profile } = await admin.from("profiles").select("looking_for, data").eq("user_id", c.id).single();
  assert.equal(profile!.looking_for, "job");
  assert.equal(profile!.data.basics.headline, "Now a graduate");
  const { count } = await admin.from("extraction_jobs").select("id", { count: "exact", head: true })
    .eq("user_id", c.id).eq("kind", "embed");
  assert.equal(count, 1);
});

// ── deletion: refused ────────────────────────────────────────────────────
test("logged out → 401, a company → 403", async () => {
  assert.equal((await deleteAccount(null, { confirm: "DELETE" })).status, 401);
  assert.equal((await deleteAccount(company.cookie, { confirm: "DELETE" })).status, 403);
  assert.ok((await admin.auth.admin.getUserById(company.id)).data.user, "the company still exists");
});

test("without typing DELETE exactly → 400, nothing deleted", async () => {
  const c = await approvedCandidate();
  for (const body of [{}, { confirm: "delete" }, { confirm: "DELETE " }, { confirm: true }]) {
    const r = await deleteAccount(c.cookie, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.error, "not_confirmed");
  }
  assert.equal((await leftovers(c.id)).profiles, 1);
});

// ── deletion: done ───────────────────────────────────────────────────────
test("after deletion, no row about the candidate remains in any table, and no file", async () => {
  const c = await approvedCandidate();
  const other = await approvedCandidate();
  // Everything a candidate can have: a live profile with an embedding, a draft, jobs, a waiting CV file.
  await admin.from("profiles").update({ embedding: `[${Array(1024).fill(0.03125).join(",")}]` }).eq("user_id", c.id);
  await admin.from("profile_drafts").insert({ user_id: c.id, data: example, provider: "gemini" });
  await admin.from("extraction_jobs").insert({ user_id: c.id, kind: "embed" });
  assert.equal((await upload(c.cookie)).status, 201);
  const before = await leftovers(c.id);
  assert.deepEqual(before, { profiles: 1, profile_drafts: 1, companies: 0, extraction_jobs: 2 });
  assert.equal((await filesOf(c.id)).length, 1);

  const r = await deleteAccount(c.cookie, { confirm: "DELETE" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { redirect: "/" });

  assert.deepEqual(await leftovers(c.id), { profiles: 0, profile_drafts: 0, companies: 0, extraction_jobs: 0 });
  assert.equal((await filesOf(c.id)).length, 0, "no CV file left in uploads-tmp");
  assert.equal((await admin.auth.admin.getUserById(c.id)).data.user, null, "the login is gone");
  assert.equal((await leftovers(other.id)).profiles, 1, "another candidate is untouched");

  // The old session can't do anything any more.
  assert.equal((await upload(c.cookie)).status, 401);
});
