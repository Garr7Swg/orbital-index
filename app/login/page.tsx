import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { SignInForm } from "@/components/auth/SignInForm";
import { hasDatabase } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — Orbital Index",
  description: "Sign in to save launches to your watchlist.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const configured = supabaseConfigured();

  return (
    <div className="mx-auto max-w-md py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-3" aria-hidden /> Back to mission control
      </Link>

      <div className="panel mt-4 p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-ion" aria-hidden />
          <p className="eyebrow">Crew access</p>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Accounts unlock a per-user launch watchlist. Browsing the manifest and maps never requires
          an account.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-alert/25 bg-alert/8 p-2.5 text-[11px] text-alert">
            {error === "auth_not_configured"
              ? "Authentication is not configured on this deployment."
              : decodeURIComponent(error)}
          </p>
        )}

        {!configured && (
          <div className="mt-5 rounded-xl border border-solar/25 bg-solar/[0.06] p-3">
            <p className="text-[11px] font-medium text-solar">Auth is not configured yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-solar/85">
              Create a Supabase project, enable GitHub and/or email auth, then set{" "}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
              <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>. Add{" "}
              <span className="font-mono">DATABASE_URL</span> too so watchlists persist.
            </p>
          </div>
        )}

        {configured && <SignInForm nextPath={next ?? "/launches"} />}

        <div className="mt-6 flex items-start gap-2 border-t border-white/8 pt-4">
          <KeyRound className="mt-0.5 size-3.5 shrink-0 text-muted/70" aria-hidden />
          <p className="text-[10px] leading-relaxed text-muted/70">
            Sessions are held in secure HTTP-only cookies by Supabase. We never see your password —{" "}
            {hasDatabase()
              ? "your watchlist is stored against your Supabase user id."
              : "but the watchlist needs Postgres to persist."}
          </p>
        </div>
      </div>
    </div>
  );
}
