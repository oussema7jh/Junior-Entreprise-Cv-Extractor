// S1-32 · POST /api/profile/approve — the candidate approves their reviewed draft.
// Body: { updated_at } — the draft version the review form saved (S1-30/31). Returns
// { redirect: "/candidate/approved" }. From then on, active companies can see the profile.
//
// The draft is read with the candidate's own client (RLS: only their own), checked against the
// schema and the approval rule here on the server, then approved in one database step
// (approve_profile, service role only) that refuses if the draft changed in the meantime.
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkApproval } from "@/lib/profile/approval";

const error = (status: number, code: string, extra: object = {}) =>
  Response.json({ error: code, ...extra }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return error(401, "not_logged_in");
  if (user.role !== "candidate" || !user.emailConfirmed) return error(403, "not_candidate");

  const body = await request.json().catch(() => null);
  const updatedAt = body?.updated_at;
  if (typeof updatedAt !== "string" || !updatedAt || updatedAt.length > 64) return error(400, "invalid");

  const supabase = await createClient();
  const [{ data: draft }, { data: profile }] = await Promise.all([
    supabase.from("profile_drafts").select("data").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("looking_for").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!draft || !profile) return error(404, "no_draft");

  // looking_for is the candidate's choice on the upload page, never the AI's: the one made with this
  // draft's upload (S2-16), else the profile's. approve_profile copies it onto the live profile.
  const check = checkApproval({ ...draft.data, looking_for: draft.data?.looking_for ?? profile.looking_for });
  if (!check.ok) return error(422, "invalid_profile", { fields: check.fields });

  const { data: publicId, error: failed } = await createAdminClient().rpc("approve_profile", {
    p_user_id: user.id,
    p_data: check.profile,
    p_draft_updated_at: updatedAt,
  });
  if (failed) return error(failed.code === "22007" ? 400 : 500, failed.code === "22007" ? "invalid" : "failed");
  if (!publicId) return error(409, "conflict"); // the draft changed since the form loaded it
  return Response.json({ redirect: "/candidate/approved" });
}
