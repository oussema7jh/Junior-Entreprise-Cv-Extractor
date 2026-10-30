import { Suspense } from "react";
import AuthForm, { type AuthMode } from "./auth-form";
import en from "@/messages/en.json";

export default function AuthPage({ mode }: { mode: AuthMode }) {
  return <Suspense fallback={<p className="p-8" role="status">{en.candidateAuth.working}</p>}><AuthForm key={mode} mode={mode} /></Suspense>;
}
