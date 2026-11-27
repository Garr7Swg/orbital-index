"use client";

import { useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setState("sending");
    setError(null);

    const origin = window.location.origin;
    const redirect = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    });

    if (authError) {
      setError(authError.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  async function signInWithGithub() {
    if (!supabase) return;
    setOauthPending(true);
    setError(null);
    const origin = window.location.origin;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (authError) {
      setError(authError.message);
      setOauthPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <button
        type="button"
        onClick={signInWithGithub}
        disabled={oauthPending}
        className="btn w-full justify-center text-xs"
      >
        {oauthPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <GithubMark className="size-3.5" />
        )}
        Continue with GitHub
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">or email</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      {state === "sent" ? (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/8 p-3 text-[11px] leading-relaxed text-emerald-200">
          Check <span className="font-medium">{email}</span> for a sign-in link. It opens this
          dashboard and keeps your session for later visits.
        </div>
      ) : (
        <form onSubmit={sendMagicLink} className="space-y-2">
          <label className="block">
            <span className="eyebrow">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="field mt-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={state === "sending" || !email.trim()}
            className="btn btn-primary w-full justify-center text-xs"
          >
            {state === "sending" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-3.5" aria-hidden />
            )}
            Send sign-in link
          </button>
        </form>
      )}

      {error && <p className="text-[11px] text-alert">{error}</p>}

      <p className="text-[10px] leading-relaxed text-muted/60">
        Signing up and signing in are the same step — a new email creates an account.
      </p>
    </div>
  );
}
