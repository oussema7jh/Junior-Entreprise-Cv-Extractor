"use client";
// S1-14 · The EN / FR switch in the header. It saves the choice in a cookie (i18n/actions.ts) and
// reloads the page's server parts, so every text changes without leaving the page.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locales";
import { cn } from "cn";

export function LanguageSwitch() {
  const t = useTranslations("site.language");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("label")} className="flex rounded-lg border bg-background p-0.5">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          title={t(locale)}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocale(locale);
              router.refresh();
            })
          }
          className={cn(
            "h-8 min-w-10 rounded-md px-2 text-xs font-semibold uppercase transition-colors disabled:opacity-60",
            locale === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
