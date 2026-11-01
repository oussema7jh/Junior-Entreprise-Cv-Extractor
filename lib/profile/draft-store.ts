import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileDraft } from "./draft-schema";

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; reason: "unauthorized" | "invalid" | "failed" | "conflict" };

/** Receives the verified session user ID from the server action, never from form data. */
export async function updateDraft(client: SupabaseClient, userId: string, input: ProfileDraft, updatedAt: string): Promise<SaveResult> {
  // The form doesn't edit looking_for: keep the draft's own (the choice made with its upload, S2-16),
  // else the profile's for drafts made before it was stored there.
  const [{ data: draft, error: draftError }, { data: profile, error: profileError }] = await Promise.all([
    client.from("profile_drafts").select("looking_for:data->>looking_for").eq("user_id", userId).maybeSingle(),
    client.from("profiles").select("looking_for").eq("user_id", userId).maybeSingle(),
  ]);
  if (draftError || profileError) return { ok: false, reason: "failed" };
  const data = { ...input, looking_for: draft?.looking_for ?? profile?.looking_for ?? null };
  const { data: saved, error } = await client.from("profile_drafts")
    .update({ data }).eq("user_id", userId).eq("updated_at", updatedAt)
    .select("updated_at").maybeSingle();
  if (error) return { ok: false, reason: "failed" };
  if (!saved) return { ok: false, reason: "conflict" };
  return { ok: true, updatedAt: saved.updated_at as string };
}
