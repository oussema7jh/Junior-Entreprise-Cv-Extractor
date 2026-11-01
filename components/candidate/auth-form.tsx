"use client";
// S1-26 · Sign up, log in, forgot password and reset password: one form, four modes.
// Every auth call goes through POST /api/candidate/auth (server side); this form only shows the result.
// Texts come from messages/ (S1-14); the language is the one chosen in the header switch.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/site/page-container";
import { validateAuth, type AuthError } from "@/lib/candidate-auth";

export type AuthMode = "signup" | "login" | "forgot" | "reset";
type Notice = "checkEmail" | "resetEmail" | "passwordUpdated" | "confirmed";
const paths = { signup: "/candidate/signup", login: "/candidate/login", forgot: "/candidate/forgot-password", reset: "/candidate/reset-password" };
const errors: AuthError[] = ["invalidEmail", "weakPassword", "passwordMismatch", "invalidCredentials", "emailNotConfirmed", "emailUsed", "rateLimit", "invalidLink", "wrongRole", "unavailable", "failed"];
const notices: Notice[] = ["checkEmail", "resetEmail", "passwordUpdated", "confirmed"];

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const t = useTranslations("candidateAuth");
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(params.get("error") === "invalidLink" ? "invalidLink" : null);
  const [message, setMessage] = useState<Notice | null>(params.get("notice") === "confirmed" ? "confirmed" : null);
  const [done, setDone] = useState(false);
  const emailNeeded = mode !== "reset";
  const passwordNeeded = mode !== "forgot";
  const confirmationNeeded = mode === "signup" || mode === "reset";

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
        // locale: the email links bring the candidate back in the language they signed up in.
        body: JSON.stringify({ action: mode, email, password, confirmation, locale }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(errors.includes(result.error) ? result.error : "failed");
        return;
      }
      if (typeof result.redirect === "string" && result.redirect.startsWith("/candidate")) {
        router.replace(result.redirect);
        router.refresh();
        return;
      }
      if (notices.includes(result.message)) {
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

  return (
    <PageContainer className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl font-semibold">{t(`pages.${mode}.title`)}</CardTitle>
          <CardDescription className="text-base">{t(`pages.${mode}.description`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate aria-busy={busy} className="flex flex-col gap-5">
            {!done && <>
              {emailNeeded && (
                <div className="grid gap-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} disabled={busy} />
                </div>
              )}
              {passwordNeeded && (
                <div className="grid gap-2">
                  <Label htmlFor="password">{mode === "reset" ? t("newPassword") : t("password")}</Label>
                  <Input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required disabled={busy} aria-describedby={confirmationNeeded ? "password-hint" : undefined} />
                  {confirmationNeeded && <p id="password-hint" className="text-sm text-muted-foreground">{t("passwordHint")}</p>}
                </div>
              )}
              {confirmationNeeded && (
                <div className="grid gap-2">
                  <Label htmlFor="confirmation">{t("confirmPassword")}</Label>
                  <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required disabled={busy} />
                </div>
              )}
            </>}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t(`errors.${error}`)}</p>}
            {message && <p role="status" className="rounded-lg border bg-secondary p-3 text-sm">{t(`messages.${message}`)}</p>}
            {!done && (
              <Button type="submit" size="lg" disabled={busy} className="w-full">
                {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {busy ? t("working") : t(`pages.${mode}.submit`)}
                {!busy && <ArrowRight aria-hidden="true" />}
              </Button>
            )}
            {mode === "login" && <Link href={paths.forgot} className="text-center text-sm underline underline-offset-4">{t("forgotLink")}</Link>}
            {(mode !== "login" || done) && <Link href={paths.login} className="text-center text-sm underline underline-offset-4">{t("loginLink")}</Link>}
          </form>
        </CardContent>
      </Card>
      {mode === "login" && (
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")} <Link href={paths.signup} className="font-medium text-foreground underline underline-offset-4">{t("signupLink")}</Link>
        </p>
      )}
    </PageContainer>
  );
}
