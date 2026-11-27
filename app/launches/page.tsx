import type { Metadata } from "next";
import { LaunchExplorer } from "@/components/launches/LaunchExplorer";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { listFavorites } from "@/lib/favorites";
import { getLaunchData } from "@/lib/store";
import { getSessionUser, supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Launch manifest — Orbital Index",
  description: "Search and filter every upcoming and completed launch tracked by Launch Library 2.",
};

export default async function LaunchesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const user = await getSessionUser();

  let data;
  try {
    data = await getLaunchData();
  } catch (error) {
    return <ErrorPanel detail={error instanceof Error ? error.message : undefined} />;
  }

  const favorites = user ? await listFavorites(user.id) : [];
  const launches = [...data.upcoming, ...data.previous];

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Launch manifest</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {data.upcoming.length} upcoming · {data.previous.length} completed
          </h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
            Global schedule from Launch Library 2. Filter by provider, status or free text — then open
            a mission for windows, orbits and webcasts.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="chip">
            {data.source === "database" ? "postgres snapshot" : data.source === "cache" ? "edge cache" : "live ll2"}
          </span>
          {!supabaseConfigured() && (
            <span className="text-[10px] text-muted/60">
              Sign-in is not configured — saving launches is disabled.
            </span>
          )}
          {supabaseConfigured() && !user && (
            <span className="text-[10px] text-muted/60">
              Signed out — sign in to save missions to your watchlist.
            </span>
          )}
        </div>
      </header>

      <LaunchExplorer
        launches={launches}
        favorites={favorites}
        signedIn={Boolean(user)}
        initialQuery={q ?? ""}
        now={Date.parse(data.fetchedAt)}
      />
    </div>
  );
}
