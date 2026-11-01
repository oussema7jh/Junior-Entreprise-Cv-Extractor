// /candidate · Where the landing page's "I'm a candidate" leads. It shows nothing itself: logged out →
// the login page; logged in → the candidate's next step (lib/candidate/next-step.ts).
// It reads the login cookie, so the redirect happens inside <Suspense> (CLAUDE.md rule 11).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCandidateState, nextStep } from "@/lib/candidate/next-step";
import { PageContainer } from "@/components/site/page-container";

export default async function CandidatePage() {
  const t = await getTranslations("candidateAuth");
  return (
    <PageContainer className="items-center justify-center">
      <Suspense fallback={<p role="status">{t("working")}</p>}>
        <GoToNextStep />
      </Suspense>
    </PageContainer>
  );
}

async function GoToNextStep() {
  const user = await getCurrentUser();
  if (!user || user.role !== "candidate") redirect("/candidate/login");
  redirect(nextStep(await loadCandidateState(await createClient(), user.id)));
  return null;
}
