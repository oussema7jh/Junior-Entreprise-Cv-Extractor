// Next.js 16 "proxy" (it was called middleware before): runs before every page request.
// Keeps login fresh and gates each role's pages and APIs (S2-01).
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every path except static files and images, which don't need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
