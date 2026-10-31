// Integration point for S2-16; do not silently provide a broken delete button.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/site/page-container";
export default async function Page() {
  const t = await getTranslations("myProfile");
  return <PageContainer className="max-w-xl"><h1 className="text-2xl font-semibold">{t("delete")}</h1><p>{t("accountPending")}</p><Link href="/candidate/profile" className="underline">{t("back")}</Link></PageContainer>;
}
