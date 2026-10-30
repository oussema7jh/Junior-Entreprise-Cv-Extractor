"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export default function SignOutButton() {
  const router = useRouter();
  const locale = useSearchParams().get("lang") === "fr" ? "fr" : "en";
  const t = (locale === "fr" ? fr : en).candidateAuth;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/candidate/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout", locale }), signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error();
      router.replace(`/candidate/login?lang=${locale}`);
      router.refresh();
    } catch { setError(true); setBusy(false); }
  }
  return <div className="text-right"><Button type="button" variant="outline" disabled={busy} onClick={signOut}>{busy ? t.working : t.logout}</Button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{t.errors.unavailable}</p>}</div>;
}
