"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ExternalLink,
  MapPin,
  Orbit,
  PlayCircle,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { Countdown } from "./Countdown";
import { formatNet, formatShort, relativeTime, statusTone } from "@/lib/format";
import type { LaunchSummary } from "@/lib/types";

type Scope = "upcoming" | "all" | "past";

export function LaunchExplorer({
  launches,
  favorites,
  signedIn,
  initialQuery = "",
  now,
}: {
  launches: LaunchSummary[];
  favorites: string[];
  signedIn: boolean;
  initialQuery?: string;
  now: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [selected, setSelected] = useState<LaunchSummary | null>(null);
  const [saved, setSaved] = useState<string[]>(favorites);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const providers = useMemo(
    () => [...new Set(launches.map((l) => l.provider))].sort((a, b) => a.localeCompare(b)),
    [launches],
  );
  const statuses = useMemo(
    () => [...new Set(launches.map((l) => l.statusAbbrev))].sort(),
    [launches],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return launches
      .filter((launch) => {
        const time = Date.parse(launch.net);
        if (scope === "upcoming" && time < now) return false;
        if (scope === "past" && time >= now) return false;
        if (status !== "all" && launch.statusAbbrev !== status) return false;
        if (provider !== "all" && launch.provider !== provider) return false;
        if (!q) return true;
        return [
          launch.name,
          launch.mission,
          launch.missionType,
          launch.provider,
          launch.rocket,
          launch.orbit,
          launch.pad,
          launch.padLocation,
          launch.country,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) =>
        scope === "past" ? Date.parse(b.net) - Date.parse(a.net) : Date.parse(a.net) - Date.parse(b.net),
      );
  }, [launches, query, scope, status, provider, now]);

  async function toggleFavorite(launch: LaunchSummary) {
    if (!signedIn) {
      router.push("/login?next=/launches");
      return;
    }
    const isSaved = saved.includes(launch.id);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launchId: launch.id, action: isSaved ? "remove" : "add" }),
      });
      const data = (await res.json()) as { favorites?: string[]; error?: string };
      if (!res.ok) {
        setSaveError(data.error ?? "Could not save this launch.");
        return;
      }
      setSaved(data.favorites ?? []);
    } catch {
      setSaveError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="panel sticky top-[68px] z-30 mb-4 p-3 backdrop-blur-xl">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted/60" aria-hidden />
            <input
              className="field pl-9"
              placeholder="Search missions, rockets, providers, pads…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search launches"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {(["upcoming", "all", "past"] as Scope[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                    scope === value ? "bg-ion/15 text-ion" : "text-muted hover:text-ink"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <select
              className="field w-auto py-1.5 text-xs"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              className="field w-auto max-w-[190px] py-1.5 text-xs"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              aria-label="Filter by provider"
            >
              <option value="all">All providers</option>
              {providers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          <span className="text-ion">{filtered.length}</span> launches
          <span className="text-muted/40">/</span>
          <span>{launches.length} loaded</span>
          {signedIn && saved.length > 0 && (
            <>
              <span className="text-muted/40">/</span>
              <span className="flex items-center gap-1 text-solar">
                <BookmarkCheck className="size-3" aria-hidden /> {saved.length} saved
              </span>
            </>
          )}
          {saveError && <span className="text-alert normal-case">{saveError}</span>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel grid place-items-center p-14 text-center">
          <Rocket className="size-8 text-muted/40" aria-hidden />
          <p className="mt-3 text-sm text-ink">No launches match those filters.</p>
          <p className="mt-1 text-xs text-muted">Try clearing the search or widening the scope.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, 90).map((launch) => {
            const isSaved = saved.includes(launch.id);
            const future = Date.parse(launch.net) > now;
            return (
              <article
                key={launch.id}
                id={`launch-${launch.id}`}
                className="panel panel-interactive group flex flex-col overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setSelected(launch)}
                  className="relative block aspect-[16/9] w-full overflow-hidden text-left"
                  aria-label={`Open details for ${launch.name}`}
                >
                  {launch.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={launch.image}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover opacity-85 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(110,231,255,0.14),transparent_70%)]">
                      <Orbit className="size-10 text-ion/40" aria-hidden />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
                  <span className={`chip absolute left-3 top-3 border bg-void/70 backdrop-blur ${statusTone(launch.statusAbbrev)}`}>
                    {launch.statusAbbrev}
                  </span>
                  <span className="absolute bottom-2.5 left-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink/85">
                    {formatShort(launch.net)}
                  </span>
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">
                    {launch.name}
                  </h3>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <Rocket className="size-3" aria-hidden /> {launch.rocket}
                    </span>
                    <span className="text-muted/30">·</span>
                    <span>{launch.provider}</span>
                  </p>
                  <p className="mt-1 flex items-start gap-1 text-[11px] text-muted/80">
                    <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                    <span className="line-clamp-1">
                      {launch.pad} — {launch.padLocation || launch.country || "TBD"}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {launch.orbitAbbrev && <span className="chip">{launch.orbitAbbrev} orbit</span>}
                    {launch.missionType && <span className="chip">{launch.missionType}</span>}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    {future ? (
                      <Countdown net={launch.net} compact />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                        {relativeTime(launch.net)}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelected(launch)}
                        className="rounded-md p-1.5 text-muted transition hover:bg-white/8 hover:text-ink"
                        aria-label="Open details"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(launch)}
                        disabled={saving}
                        className={`rounded-md p-1.5 transition hover:bg-white/8 ${
                          isSaved ? "text-solar" : "text-muted hover:text-ink"
                        }`}
                        aria-label={isSaved ? "Remove saved launch" : "Save launch"}
                        title={signedIn ? "Save launch" : "Sign in to save launches"}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="size-3.5" aria-hidden />
                        ) : (
                          <Bookmark className="size-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filtered.length > 90 && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          showing 90 of {filtered.length} — refine your search
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-void/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-abyss/95 p-5 scrollbar-thin">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Mission brief</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug text-ink">{selected.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-muted hover:bg-white/8 hover:text-ink"
                aria-label="Close details"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            {selected.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.image}
                alt=""
                className="mt-4 aspect-video w-full rounded-lg border border-white/10 object-cover"
              />
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className={`chip border ${statusTone(selected.statusAbbrev)}`}>{selected.status}</span>
              {selected.probability !== null && (
                <span className="chip border-solar/25 text-solar">{selected.probability}% weather go</span>
              )}
              {selected.orbitAbbrev && <span className="chip">{selected.orbitAbbrev}</span>}
            </div>

            {Date.parse(selected.net) > now && (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="eyebrow mb-2 flex items-center gap-1">
                  <CalendarClock className="size-3" aria-hidden /> lift-off in
                </p>
                <Countdown net={selected.net} />
              </div>
            )}

            <dl className="mt-4 space-y-0">
              {(
                [
                  ["NET (UTC)", formatNet(selected.net)],
                  ["Vehicle", selected.rocket],
                  ["Provider", `${selected.provider}${selected.providerType ? ` · ${selected.providerType}` : ""}`],
                  ["Mission", selected.mission || "—"],
                  ["Mission type", selected.missionType || "—"],
                  ["Target orbit", selected.orbit || "—"],
                  ["Pad", `${selected.pad}${selected.padLocation ? `, ${selected.padLocation}` : ""}`],
                  ["Country", selected.country || "—"],
                  ["Window opens", formatNet(selected.windowStart)],
                  ["Window closes", formatNet(selected.windowEnd)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-white/6 py-2.5"
                >
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
                  <dd className="max-w-[62%] text-right text-xs text-ink/90">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {selected.webcast && (
                <a href={selected.webcast} target="_blank" rel="noreferrer" className="btn btn-primary text-xs">
                  <PlayCircle className="size-3.5" aria-hidden /> Watch webcast
                </a>
              )}
              {selected.infoUrl && (
                <a href={selected.infoUrl} target="_blank" rel="noreferrer" className="btn text-xs">
                  Launch Library record <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              )}
              <button
                type="button"
                onClick={() => toggleFavorite(selected)}
                className={`btn text-xs ${saved.includes(selected.id) ? "text-solar" : ""}`}
              >
                {saved.includes(selected.id) ? (
                  <BookmarkCheck className="size-3.5" aria-hidden />
                ) : (
                  <Bookmark className="size-3.5" aria-hidden />
                )}
                {saved.includes(selected.id) ? "Saved" : "Save launch"}
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-muted/70">
              Times are as published by Launch Library 2 and can slip. Always confirm with the
              operator&apos;s stream before travelling.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
