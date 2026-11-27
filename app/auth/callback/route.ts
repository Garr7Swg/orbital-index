import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/launches";
  const supabase = await createSupabaseServerClient();
  const { origin } = resolveSiteUrl(url);

  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=auth_not_configured", origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }
  return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/launches", origin));
}
