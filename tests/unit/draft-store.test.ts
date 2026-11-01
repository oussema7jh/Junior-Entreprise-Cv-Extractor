import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { updateDraft } from "@/lib/profile/draft-store";
import { ProfileSchema } from "@/lib/profile/schema.gen";
import example from "../fixtures/example-profile.json";

test("draft writes use the owner/version, preserve upload choice and replace removed arrays", async () => {
  const requests: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient("https://example.supabase.co", "test-key", { auth: { persistSession: false }, global: { fetch: async (url, init) => {
    const request = { url: new URL(String(url)), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
    requests.push(request);
    return new Response(JSON.stringify(request.method === "PATCH" ? { updated_at: "new-version" } : { looking_for: "pfe" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } } });
  const result = await updateDraft(client, "session-owner", ProfileSchema.parse({ ...example, looking_for: "job", education: [] }), "old-version");
  assert.deepEqual(result, { ok: true, updatedAt: "new-version" });
  const write = requests.find((item) => item.method === "PATCH")!;
  assert.equal(write.url.searchParams.get("user_id"), "eq.session-owner");
  assert.equal(write.url.searchParams.get("updated_at"), "eq.old-version");
  assert.equal((write.body as { data: { looking_for: string } }).data.looking_for, "pfe");
  assert.deepEqual((write.body as { data: { education: unknown[] } }).data.education, []);
});
test("a concurrent approval or draft replacement reports a conflict", async () => {
  const client = createClient("https://example.supabase.co", "test-key", { auth: { persistSession: false }, global: { fetch: async (_url, init) => new Response(JSON.stringify(init?.method === "PATCH" ? null : { looking_for: "pfe" }), { status: 200, headers: { "Content-Type": "application/json" } }) } });
  assert.deepEqual(await updateDraft(client, "session-owner", ProfileSchema.parse(example), "old"), { ok: false, reason: "conflict" });
});
