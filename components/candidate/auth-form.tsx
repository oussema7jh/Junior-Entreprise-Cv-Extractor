"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateAuth, type AuthError } from "@/lib/candidate-auth";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export type AuthMode = "signup" | "login" | "forgot" | "reset";
const paths = { signup: "/candidate/signup", login: "/candidate/login", forgot: "/candidate/forgot-password", reset: "/candidate/reset-password" };

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const params = useSearchParams();
  const locale = params.get("lang") === "fr" ? "fr" : "en";
  const t = (locale === "fr" ? fr : en).candidateAuth;
  const copy = t.pages[mode];
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(params.get("error") === "invalidLink" ? "invalidLink" : null);
  const [message, setMessage] = useState<keyof typeof t.messages | null>(params.get("notice") === "confirmed" ? "confirmed" : null);
  const [done, setDone] = useState(false);
  const emailNeeded = mode !== "reset";
  const passwordNeeded = mode !== "forgot";
  const confirmationNeeded = mode === "signup" || mode === "reset";
  const href = (target: AuthMode) => `${paths[target]}?lang=${locale}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    const problem = validateAuth(mode, email, password, confirmation);
    setError(problem);
    setMessage(null);
    if (problem) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/candidate/auth", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: mode, email, password, confirmation, locale }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(Object.hasOwn(t.errors, result.error) ? result.error : "failed");
        return;
      }
      if (["/candidate/upload", "/candidate/profile"].includes(result.redirect)) {
        router.replace(result.redirect);
        router.refresh();
        return;
      }
      if (Object.hasOwn(t.messages, result.message)) {
        setMessage(result.message);
        setDone(true);
        formElement.reset();
      } else setError("failed");
    } catch {
      setError("unavailable");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const fieldClass = "mt-2 min-h-12 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60";
  return (
    <main lang={locale} className="flex min-h-screen flex-col bg-muted/35 font-[family-name:var(--font-geist-sans)]">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold"><span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FileText size={20} aria-hidden="true" /></span>{t.brand}</Link>
          <nav aria-label={t.language} className="flex gap-3 text-sm">
            <Link href={`${paths[mode]}?lang=en`} aria-current={locale === "en" ? "page" : undefined} className={locale === "en" ? "font-semibold underline underline-offset-4" : "text-muted-foreground"}>{t.english}</Link>
            <Link href={`${paths[mode]}?lang=fr`} aria-current={locale === "fr" ? "page" : undefined} className={locale === "fr" ? "font-semibold underline underline-offset-4" : "text-muted-foreground"}>{t.french}</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-md px-5 py-10 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{copy.description}</p>
        <form onSubmit={submit} noValidate aria-busy={busy} className="mt-7 space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
          {!done && <>
            {emailNeeded && <div><label htmlFor="email" className="text-sm font-medium">{t.email}</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={busy} className={fieldClass} /></div>}
            {passwordNeeded && <div><label htmlFor="password" className="text-sm font-medium">{mode === "reset" ? t.newPassword : t.password}</label><input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required disabled={busy} aria-describedby={confirmationNeeded ? "password-hint" : undefined} className={fieldClass} />{confirmationNeeded && <p id="password-hint" className="mt-2 text-xs text-muted-foreground">{t.passwordHint}</p>}</div>}
            {confirmationNeeded && <div><label htmlFor="confirmation" className="text-sm font-medium">{t.confirmPassword}</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy} className={fieldClass} /></div>}
          </>}
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">{t.errors[error]}</p>}
          {message && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">{t.messages[message]}</p>}
          {!done && <Button type="submit" disabled={busy} className="min-h-12 w-full text-base">{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}{busy ? t.working : copy.submit}{!busy && <ArrowRight aria-hidden="true" />}</Button>}
          {mode === "login" && <Link href={href("forgot")} className="block text-center text-sm underline underline-offset-4">{t.forgotLink}</Link>}
          {(mode !== "login" || done) && <Link href={href("login")} className="block text-center text-sm underline underline-offset-4">{t.loginLink}</Link>}
        </form>
        {mode === "login" && <p className="mt-6 text-center text-sm text-muted-foreground">{t.noAccount} <Link href={href("signup")} className="font-medium text-foreground underline underline-offset-4">{t.signupLink}</Link></p>}
        <p className="mt-6 text-center text-xs text-muted-foreground">{t.organizer}</p>
      </div>
    </main>
  );
}
