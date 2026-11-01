// S1-14 · The site's two languages. The choice is kept in a cookie, so page addresses don't change.
export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
// Used when the visitor has made no choice and their browser asks for neither language.
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

// "fr-FR,fr;q=0.9,en;q=0.8" → "fr". The first language in the browser's list that we have wins.
export function localeFromAcceptLanguage(header: string | null): Locale {
  for (const part of (header ?? "").split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return defaultLocale;
}
