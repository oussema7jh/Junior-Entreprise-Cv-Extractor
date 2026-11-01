"use client";
// S1-14 · Keeps <html lang="…"> in step with the chosen language (screen readers and browser
// translation rely on it). <html> sits outside the language-aware part of the layout, so it is set here.
import { useEffect } from "react";
import { useLocale } from "next-intl";

export function HtmlLang() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
