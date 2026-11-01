// S1-14 · next-intl reads this on every request to know the language and load its texts.
// Order: the visitor's choice (cookie, set by the EN/FR switch) → their browser's language → English.
// It reads cookies and headers, so anything that shows translated text sits inside <Suspense>
// (Cache Components); app/layout.tsx already wraps every page.
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage } from "./locales";

export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen) ? chosen : localeFromAcceptLanguage((await headers()).get("accept-language"));
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
