// S1-14 · Lets TypeScript check every t("…") key against messages/en.json: a typo fails the build.
import type { Locale } from "@/i18n/locales";
import type en from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
