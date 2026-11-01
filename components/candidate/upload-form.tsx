"use client";
// S1-28 · The CV upload form: what they're looking for, the file (or a photo on a phone), and consent.
// The button stays disabled until all three are there. The server checks everything again (S1-23)
// and its refusals are shown with its own message, already in the visitor's language.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Camera, Check, FileText, LoaderCircle, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CV_ACCEPT, LOOKING_FOR, UploadFailure, uploadCv, validateCvFile, type LookingFor, type UploadError } from "@/lib/upload";

// What is wrong right now: one of our own checks, or the server's sentence.
type Problem = { code: UploadError } | { message: string };

export default function UploadForm() {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [lookingFor, setLookingFor] = useState<LookingFor | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ready = !!lookingFor && !!file && consent && !busy;
  const fail = (code: UploadError | null) => setProblem(code ? { code } : null);

  function selectFiles(files: FileList | null) {
    if (inFlight.current || !files?.length) return;
    const nextFile = files[0];
    const issue = files.length > 1 ? "multipleFiles" : validateCvFile(nextFile);
    setFile(issue ? null : nextFile);
    fail(issue);
    // Reset both inputs so choosing the same file again triggers onChange.
    if (picker.current) picker.current.value = "";
    if (camera.current) camera.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const issue = !lookingFor ? "noChoice" : !file ? "noFile" : validateCvFile(file) || (!consent ? "noConsent" : null);
    if (issue || !file || !lookingFor) { fail(issue); return; }
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const jobId = await uploadCv(file, lookingFor, consent);
      router.push(`/candidate/processing/${encodeURIComponent(jobId)}`);
      // Keep the form locked until navigation completes: don't enqueue the same CV twice.
    } catch (cause) {
      if (cause instanceof UploadFailure && cause.serverMessage) setProblem({ message: cause.serverMessage });
      else fail(cause instanceof UploadFailure && cause.code === "network" ? "network" : "failed");
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold sm:text-3xl">{t("title")}</CardTitle>
        <CardDescription className="text-base">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate aria-busy={busy} className="flex flex-col gap-7">
          <fieldset disabled={busy} aria-describedby={!lookingFor ? "choice-help" : undefined}>
            <legend className="mb-3 font-semibold">{t("lookingFor")}</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {LOOKING_FOR.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="looking_for" value={value} checked={lookingFor === value} onChange={() => { setLookingFor(value); setProblem(null); }} required />
                  <span className="flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-sm transition-colors peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-semibold peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                    {lookingFor === value && <Check size={15} aria-hidden="true" />}{t(`choices.${value}`)}
                  </span>
                </label>
              ))}
            </div>
            {!lookingFor && <p id="choice-help" className="mt-2 text-sm text-muted-foreground">{t("errors.noChoice")}</p>}
          </fieldset>

          <fieldset disabled={busy}>
            <legend className="mb-3 font-semibold">{t("cv")}</legend>
            <div onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }} className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${dragging ? "border-primary bg-secondary" : "border-border bg-muted"}`}>
              <Upload className="mx-auto mb-3 text-muted-foreground" size={28} aria-hidden="true" />
              <p className="font-medium">{t("dropTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("dropDescription")}</p>
              <input ref={picker} type="file" accept={CV_ACCEPT} hidden aria-label={t("chooseFile")} onChange={(event) => selectFiles(event.target.files)} />
              {/* A second input that opens the camera directly: many students photograph their paper CV. */}
              <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label={t("takePhoto")} onChange={(event) => selectFiles(event.target.files)} />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => picker.current?.click()} disabled={busy}>{t("chooseFile")}</Button>
                <Button type="button" variant="outline" className="sm:hidden" onClick={() => camera.current?.click()} disabled={busy}><Camera aria-hidden="true" />{t("takePhoto")}</Button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("formats")}</p>
            {file && (
              <div role="status" className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border p-3">
                <FileText className="shrink-0" size={22} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(file.size / 1024)} {t("kb")}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={t("removeFile")} disabled={busy} onClick={() => { setFile(null); setProblem(null); }}><X aria-hidden="true" /></Button>
              </div>
            )}
          </fieldset>

          <div className="border-t pt-6">
            <div className="flex items-start gap-3">
              <input id="consent" name="consent" type="checkbox" checked={consent} disabled={busy} required className="mt-1 size-5 shrink-0 accent-primary" onChange={(event) => { setConsent(event.target.checked); setProblem(null); }} />
              <label htmlFor="consent" className="text-sm leading-relaxed">{t("consent")}</label>
            </div>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="ml-8 mt-2 inline-block text-sm underline underline-offset-4">{t("privacy")}</Link>
          </div>

          {problem && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{"message" in problem ? problem.message : t(`errors.${problem.code}`)}</p>}
          <div>
            <Button type="submit" size="lg" className="w-full" disabled={!ready}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {busy ? t("uploading") : t("submit")}{!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <p aria-live="polite" className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">{busy ? t("wait") : t("requirements")}</p>
          </div>
        </form>
        <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{t("reassurance")}</p>
      </CardContent>
    </Card>
  );
}
