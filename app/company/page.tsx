// Placeholder so everyone sees where their pages go. Replaced by the real page in its task.
// Texts always come from messages/ (en.json + fr.json), never typed in the page.
import { getTranslations } from "next-intl/server";

export default async function CompanyPage() {
  const t = await getTranslations("placeholder");
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <p className="text-lg">{t("company")}</p>
    </main>
  );
}
