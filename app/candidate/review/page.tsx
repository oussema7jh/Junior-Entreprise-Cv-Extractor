import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DraftSchema } from "@/lib/profile/draft-schema";
import { ProfileReviewForm } from "@/components/profile/profile-review-form";
import { getMessages } from "next-intl/server";
import { PageContainer } from "@/components/site/page-container";

// S1-30/S1-31 · /candidate/review: the candidate checks and corrects what the AI extracted, then approves.
export default async function ReviewPage() {
  const copy = (await getMessages()).review;
  return <PageContainer className="max-w-4xl">
    <Suspense fallback={<p role="status">{copy.loading}</p>}><ReviewDraft /></Suspense>
  </PageContainer>;
}

async function ReviewDraft() {
  const copy = (await getMessages()).review;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <p role="alert">{copy.unavailable}</p>;
  const user = await getCurrentUser();
  if (!user || user.role !== "candidate" || !user.emailConfirmed) return <p role="alert">{copy.unauthorized}</p>;
  const client = await createClient();
  const [{ data: draft, error }, { data: profile, error: profileError }] = await Promise.all([
    client.from("profile_drafts").select("data, updated_at").eq("user_id", user.id).maybeSingle(),
    client.from("profiles").select("looking_for").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error || profileError) return <p role="alert">{copy.failedLoad}</p>;
  if (!draft) return <p role="status">{copy.noDraft}</p>;
  const parsed = DraftSchema.safeParse({ ...draft.data, looking_for: profile?.looking_for ?? null });
  if (!parsed.success) return <p role="alert">{copy.invalidDraft}</p>;
  return <ProfileReviewForm initialValues={{ ...parsed.data, looking_for: profile?.looking_for ?? null }} updatedAt={draft.updated_at} />;
}
