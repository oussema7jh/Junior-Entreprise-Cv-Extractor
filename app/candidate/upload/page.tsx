// S1-28 · /candidate/upload: the CV upload form. Logged out → the login page.
// It reads the login cookie, so that check sits inside <Suspense> (CLAUDE.md rule 11).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { PageContainer } from "@/components/site/page-container";
import UploadForm from "@/components/candidate/upload-form";

export async function generateMetadata() {
  const t = await getTranslations("upload");
  return { title: t("pageTitle") };
}

export default async function UploadPage() {
  const t = await getTranslations("candidateAuth");
  return (
    <PageContainer className="max-w-2xl">
      <Suspense fallback={<p role="status">{t("working")}</p>}>
        <CandidateOnly />
      </Suspense>
    </PageContainer>
  );
}

async function CandidateOnly() {
  const user = await getCurrentUser();
  if (!user || user.role !== "candidate") redirect("/candidate/login");
  return <UploadForm />;
}
