// S1-27 · /privacy: what happens to a candidate's data. Linked from the footer and the upload consent.
// The texts are Achraf's (S1-27), in messages/ → privacy. Change a promise there only if the code
// changes too: every sentence here must be true of the platform.
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/site/page-container";

// Where candidates write with questions about their data (Ahmed's call).
const CONTACT_EMAIL = "pristini.cv.platform@gmail.com";
const SECTIONS = [0, 1, 2, 3] as const;

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return { title: t("pageTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <PageContainer className="max-w-2xl gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>
      {SECTIONS.map((i) => (
        <section key={i} className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">{t(`sections.${i}.title`)}</h2>
          <p className="leading-relaxed">{t(`sections.${i}.text`)}</p>
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">{t("contact.title")}</h2>
        <p className="leading-relaxed">{t("contact.text", { email: CONTACT_EMAIL })}</p>
      </section>
    </PageContainer>
  );
}
