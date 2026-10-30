import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import SignOutButton from "@/components/candidate/sign-out-button";

async function SessionControl() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <div className="border-b bg-background px-5 py-3"><div className="mx-auto max-w-5xl"><SignOutButton /></div></div>;
}

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <><Suspense fallback={null}><SessionControl /></Suspense>{children}</>;
}
