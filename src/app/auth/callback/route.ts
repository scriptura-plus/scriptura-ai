import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/study";
}

function getSafeEmailOtpType(value: string | null) {
  if (
    value === "email" ||
    value === "magiclink" ||
    value === "signup" ||
    value === "recovery" ||
    value === "invite"
  ) {
    return value;
  }

  return "email";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = getSafeEmailOtpType(requestUrl.searchParams.get("type"));
  const next = getSafeNext(requestUrl.searchParams.get("next"));
  const supabase = await createSupabaseAuthServerClient();

  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.warn("[AUTH_CALLBACK] exchangeCodeForSession failed", {
      message: error.message,
    });
  }

  if (supabase && tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.warn("[AUTH_CALLBACK] verifyOtp failed", {
      type,
      message: error.message,
    });
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  loginUrl.searchParams.set("next", next);

  return NextResponse.redirect(loginUrl);
}
