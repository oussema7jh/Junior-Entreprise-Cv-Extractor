// S2-16 · POST /api/candidate/delete — the candidate erases their account and all their data.
// Body: { confirm: "DELETE" }, the word the candidate typed. Returns { redirect: "/" }.
//
// Two steps, in this order:
//   1. Any CV file still waiting in uploads-tmp (a job not finished yet, or left by a crash).
//   2. The auth user. Every table references auth.users ON DELETE CASCADE, so the database removes
//      the profile (and its embedding), the draft and every job in the same step.
// If step 1 fails, nothing is deleted and the candidate can try again: the account is never gone
// while one of its files stays behind. The SQL check: leftover_rows() (docs/DATABASE.md).
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "uploads-tmp";
const error = (status: number, code: string) => Response.json({ error: code }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return error(401, "not_logged_in");
  if (user.role !== "candidate") return error(403, "not_candidate"); // a company or the admin: never here

  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE") return error(400, "not_confirmed");

  const admin = createAdminClient();
  // Uploads are stored as <user id>/<random>.<ext>, so the folder holds every file of this candidate.
  const { data: files, error: listFailed } = await admin.storage.from(BUCKET).list(user.id, { limit: 1000 });
  if (listFailed) return error(500, "failed");
  if (files.length) {
    const { error: removeFailed } = await admin.storage.from(BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
    if (removeFailed) return error(500, "failed");
  }

  const { error: deleteFailed } = await admin.auth.admin.deleteUser(user.id);
  if (deleteFailed) return error(500, "failed");

  // Clear the session cookies in this browser. The user is already gone, so Supabase may refuse the
  // sign-out call itself; the cookies are removed either way.
  await (await createClient()).auth.signOut({ scope: "local" }).catch(() => {});
  return Response.json({ redirect: "/" });
}
