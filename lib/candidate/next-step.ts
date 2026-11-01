// Where a logged-in candidate goes next: after login, and when they open /candidate from the landing page.
// One place decides it, so the login, the landing page and later "My profile" never disagree.
import type { SupabaseClient } from "@supabase/supabase-js";

export type CandidateState = {
  profileStatus: "draft" | "approved" | null; // null: no profile row yet (never uploaded)
  hasDraft: boolean; // the worker extracted a CV that waits for review
  activeJobId: string | null; // an extract job still queued or processing
};

export function nextStep({ profileStatus, hasDraft, activeJobId }: CandidateState): string {
  if (activeJobId) return `/candidate/processing/${activeJobId}`;
  if (hasDraft) return "/candidate/review"; // also after a re-upload of an approved profile
  if (profileStatus === "approved") return "/candidate/approved";
  return "/candidate/upload"; // new, or the last extraction failed
}

// Reads the three facts with the candidate's own client, so the access rules (RLS) apply.
export async function loadCandidateState(supabase: SupabaseClient, userId: string): Promise<CandidateState> {
  const [profile, draft, job] = await Promise.all([
    supabase.from("profiles").select("status").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_drafts").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase
      .from("extraction_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "extract")
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profile.error || draft.error || job.error) throw new Error("candidate state unavailable");
  return {
    profileStatus: (profile.data?.status as CandidateState["profileStatus"]) ?? null,
    hasDraft: Boolean(draft.data),
    activeJobId: (job.data?.id as string | undefined) ?? null,
  };
}
