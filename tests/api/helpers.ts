// Helpers for the API tests: they call the running app (npm run start) with real logins on the
// local Supabase (supabase start). Nothing is faked: a test passes only if the server really refuses.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const APP_URL = process.env.TEST_APP_URL ?? "http://127.0.0.1:3000";

// The local stack's address and keys, from `supabase status` (they are the public local defaults).
function localSupabase() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  const s = JSON.parse(execSync("supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString());
  return { url: s.API_URL as string, anon: s.ANON_KEY as string, service: s.SERVICE_ROLE_KEY as string };
}
export const supabase = localSupabase();

// Service-role client for setting up and checking: skips every access rule. Tests only.
export const admin = createClient(supabase.url, supabase.service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created: string[] = [];

export async function createUser(role: "candidate" | "company" | "admin" | null) {
  const email = `test-${randomUUID()}@example.com`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: role ? { role } : {},
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email, password, cookie: await logIn(email, password) };
}

// A supabase-js client logged in as this user, like the browser's: every access rule applies.
export async function clientAs(user: { email: string; password: string }) {
  const client = createClient(supabase.url, supabase.anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(user);
  if (error) throw error;
  return client;
}

// Logs in the way the browser does and returns the Cookie header the app expects.
async function logIn(email: string, password: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(supabase.url, supabase.anon, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

export async function deleteTestUsers() {
  for (const id of created.splice(0)) {
    const { data: jobs } = await admin.from("extraction_jobs").select("file_path").eq("user_id", id);
    const paths = (jobs ?? []).map((j) => j.file_path).filter(Boolean) as string[];
    if (paths.length) await admin.storage.from("uploads-tmp").remove(paths);
    await admin.auth.admin.deleteUser(id); // the tables cascade
  }
}

export const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
export const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0, 0, 0, 0]);

export async function upload(
  cookie: string | null,
  { file = PDF, name = "cv.pdf", consent = "true", lookingFor = "pfe" as string | null } = {},
) {
  const form = new FormData();
  if (file) form.set("file", new File([file], name));
  if (consent) form.set("consent", consent);
  if (lookingFor) form.set("looking_for", lookingFor);
  const response = await fetch(`${APP_URL}/api/cv/upload`, {
    method: "POST",
    body: form,
    headers: cookie ? { cookie } : {},
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

export async function getJob(cookie: string | null, id: string) {
  const response = await fetch(`${APP_URL}/api/cv/jobs/${id}`, { headers: cookie ? { cookie } : {} });
  return { status: response.status, body: await response.json().catch(() => null) };
}
