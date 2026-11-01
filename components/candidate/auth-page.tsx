// S1-26 · The frame of the four account pages. The form reads the address bar (?error=, ?notice=),
// so it sits inside <Suspense>.
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import AuthForm, { type AuthMode } from "./auth-form";

export default async function AuthPage({ mode }: { mode: AuthMode }) {
  const t = await getTranslations("candidateAuth");
  return (
    <Suspense fallback={<p className="p-8 text-center" role="status">{t("working")}</p>}>
      <AuthForm key={mode} mode={mode} />
    </Suspense>
  );
}

// The browser tab's title, in the visitor's language.
export async function authTitle(mode: AuthMode) {
  const t = await getTranslations("candidateAuth");
  return { title: t(`pages.${mode}.title`) };
}
