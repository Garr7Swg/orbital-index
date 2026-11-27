import Link from "next/link";
import { getSessionUser, supabaseConfigured } from "@/lib/supabase/server";
import { NavLinks } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-void/72 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid size-9 place-items-center">
            <span className="absolute inset-0 rounded-full border border-ion/30 transition-colors group-hover:border-ion/60" />
            <span className="absolute inset-1 rounded-full border border-plasma/25" />
            <span className="size-2 rounded-full bg-ion shadow-[0_0_12px_2px_rgba(110,231,255,0.7)]" />
          </span>
          <span className="leading-none">
            <span className="block text-[15px] font-semibold tracking-[0.14em] text-ink">
              ORBITAL INDEX
            </span>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.26em] text-muted">
              launch intelligence
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <NavLinks />
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300 sm:inline-flex">
            <span className="size-1.5 animate-blink rounded-full bg-emerald-400" /> live
          </span>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-[150px] truncate text-xs text-muted sm:block">
                {user.email}
              </span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="btn px-3 py-1.5 text-xs"
              title={supabaseConfigured() ? "Sign in" : "Auth is not configured yet"}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
