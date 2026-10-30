"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Camera, Check, FileText, LoaderCircle, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { CV_ACCEPT, LOOKING_FOR, uploadCv, validateCvFile, type LookingFor, type UploadError } from "@/lib/upload";

export default function UploadForm({ locale = "en" }: { locale?: "en" | "fr" }) {
  const t = (locale === "fr" ? fr : en).upload;
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [lookingFor, setLookingFor] = useState<LookingFor | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ready = !!lookingFor && !!file && consent && !busy;
  const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

  function selectFiles(files: FileList | null) {
    if (inFlight.current || !files?.length) return;
    const nextFile = files[0];
    const problem = files.length > 1 ? "multipleFiles" : validateCvFile(nextFile);
    setFile(problem ? null : nextFile);
    setError(problem);
    // Reset both inputs so choosing the same file again triggers onChange.
    if (picker.current) picker.current.value = "";
    if (camera.current) camera.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const problem = !lookingFor ? "noChoice" : !file ? "noFile" : validateCvFile(file) || (!consent ? "noConsent" : null);
    if (problem || !file || !lookingFor) { setError(problem); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const jobId = await uploadCv(file, lookingFor, consent);
      router.push(`/candidate/processing?job_id=${encodeURIComponent(jobId)}`);
      // Keep the form locked until navigation completes: don't enqueue the same CV twice.
    } catch (cause) {
      setError(cause instanceof Error && Object.hasOwn(t.errors, cause.message) ? cause.message as UploadError : "failed");
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/35 font-[family-name:var(--font-geist-sans)]" lang={locale}>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className={`flex items-center gap-3 font-semibold ${focusStyle}`}>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FileText size={20} aria-hidden="true" /></span>
            {t.brand}
          </Link>
          <span className="text-xs text-muted-foreground sm:text-sm">{t.organizer}</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
        <ol aria-label={t.progressLabel} className="mb-9 flex items-center gap-3 text-xs sm:gap-5 sm:text-sm">
          {[t.steps.upload, t.steps.review, t.steps.profile].map((step, index) => (
            <li key={step} aria-current={index === 0 ? "step" : undefined} className={`flex items-center gap-2 ${index === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${index === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{t.description}</p>

        <form onSubmit={submit} noValidate aria-busy={busy} className="mt-8 space-y-7 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
          <fieldset disabled={busy} aria-describedby={!lookingFor ? "choice-help" : undefined}>
            <legend className="mb-3 font-semibold">{t.lookingFor}</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {LOOKING_FOR.map((value) => (
                <label key={value} className="cursor-pointer">
                  <input className="peer sr-only" type="radio" name="looking_for" value={value} checked={lookingFor === value} onChange={() => { setLookingFor(value); setError(null); }} required />
                  <span className="flex min-h-12 items-center justify-center gap-1 rounded-lg border px-2 text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary peer-disabled:cursor-wait">
                    {lookingFor === value && <Check size={15} aria-hidden="true" />}{t.choices[value]}
                  </span>
                </label>
              ))}
            </div>
            {!lookingFor && <p id="choice-help" className="mt-2 text-sm text-muted-foreground">{t.errors.noChoice}</p>}
          </fieldset>

          <fieldset disabled={busy}>
            <legend className="mb-3 font-semibold">{t.cv}</legend>
            <div onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(event.dataTransfer.files); }} className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors sm:p-7 ${dragging ? "border-primary bg-primary/5" : "border-border bg-muted/25"}`}>
              <Upload className="mx-auto mb-3 text-muted-foreground" size={28} aria-hidden="true" />
              <p className="font-medium">{t.dropTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.dropDescription}</p>
              <input ref={picker} type="file" accept={CV_ACCEPT} hidden aria-label={t.chooseFile} onChange={(event) => selectFiles(event.target.files)} />
              <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label={t.takePhoto} onChange={(event) => selectFiles(event.target.files)} />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => picker.current?.click()} disabled={busy}>{t.chooseFile}</Button>
                <Button type="button" variant="outline" className="min-h-11 sm:hidden" onClick={() => camera.current?.click()} disabled={busy}><Camera aria-hidden="true" />{t.takePhoto}</Button>
              </div>
            </div>
            <p id="file-help" className="mt-2 text-sm text-muted-foreground">{t.formats}</p>
            {file && <div role="status" className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border p-3">
              <FileText className="shrink-0" size={22} aria-hidden="true" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(file.size / 1024)} {t.kb}</p></div>
              <Button type="button" variant="ghost" size="icon" aria-label={t.removeFile} disabled={busy} onClick={() => { setFile(null); setError(null); }}><X aria-hidden="true" /></Button>
            </div>}
          </fieldset>

          <div className="border-t pt-6">
            <div className="flex items-start gap-3">
              <input id="consent" name="consent" type="checkbox" checked={consent} disabled={busy} required aria-describedby="consent-help" className={`mt-1 size-4 shrink-0 accent-primary ${focusStyle}`} onChange={(event) => { setConsent(event.target.checked); setError(null); }} />
              <label htmlFor="consent" className="text-sm leading-relaxed">{t.consent}</label>
            </div>
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={`ml-7 mt-2 inline-block text-sm underline underline-offset-4 ${focusStyle}`}>{t.privacy}</Link>
            {!consent && <p id="consent-help" className="ml-7 mt-2 text-sm text-muted-foreground">{t.errors.noConsent}</p>}
          </div>

          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t.errors[error]}</p>}
          <div>
            <Button type="submit" className="min-h-12 w-full text-base" disabled={!ready} aria-describedby={!ready ? "upload-help" : undefined}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {busy ? t.uploading : t.submit}{!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <p id="upload-help" aria-live="polite" className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">{busy ? t.wait : t.requirements}</p>
          </div>
        </form>
        <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />{t.reassurance}</p>
      </main>
    </div>
  );
}
