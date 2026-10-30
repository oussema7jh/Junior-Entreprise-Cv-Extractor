import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get("lang") === "fr" ? "fr" : "en";
  const recovery = params.get("flow") === "recovery" || params.get("type") === "recovery";
  const target = new URL(recovery ? "/candidate/reset-password" : "/candidate/login", process.env.APP_URL || request.url);
  target.searchParams.set("lang", locale);
  try {
    const supabase = await createClient();
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "signup" || type === "recovery")
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : null;
    if (!result || result.error) throw new Error("invalidLink");
    if (!recovery) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      target.searchParams.set("notice", "confirmed");
    }
  } catch {
    target.pathname = recovery ? "/candidate/forgot-password" : "/candidate/login";
    target.searchParams.set("error", "invalidLink");
  }
  // Never accept an arbitrary `next` URL from an email link.
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
