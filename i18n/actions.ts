"use server";
// S1-14 · Called by the EN/FR switch: remembers the choice for a year.
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./locales";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
