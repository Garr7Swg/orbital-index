import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, MapPin, Orbit, Satellite } from "lucide-react";
import { LaunchMap } from "@/components/map/LaunchMap";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { formatShort } from "@/lib/format";
import { computePads } from "@/lib/stats";
import { getLaunchData } from "@/lib/store";
import { TLE_GROUPS } from "@/lib/tle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live launch & orbit map — Orbital Index",
  description:
    "Interactive OpenFreeMap-backed map of launch pads and satellites propagated live from CelesTrak TLEs.",
};

export default async function MapPage() {
  let data;
  try {
    data = await getLaunchData();
  } catch (error) {
    return <ErrorPanel detail={error instanceof Error ? error.message : undefined} />;
  }

  const pads = computePads(data.upcoming);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Live map</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Launch pads & orbital traffic
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
            Pads are sized by upcoming cadence. Satellites are propagated in your browser from public
            TLEs every second. Click any satellite to draw its next-90-minute ground track.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">{pads.length} pads</span>
          <span className="chip border-ion/25 text-ion">openfreemap dark</span>
        </div>
      </header>

      <LaunchMap pads={pads} />

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="panel p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Busiest launch sites</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              upcoming cadence
            </span>
          </div>
          <div className="mt-3 divide-y divide-white/6">
            {pads.slice(0, 12).map((pad) => (
              <div key={pad.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.03]">
                  <MapPin className="size-3.5 text-ion/80" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink/90">{pad.name}</p>
                  <p className="truncate text-[10px] text-muted">
                    {pad.location}
                    {pad.country ? ` · ${pad.country}` : ""}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="font-mono text-[10px] text-ink/80">{pad.next?.status ?? "—"}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    {pad.next ? formatShort(pad.next.net) : "no upcoming"}
                  </p>
                </div>
                <span className="chip shrink-0 border-ion/25 text-ion">{pad.launches}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted/70">
            Pad count reflects missions in the current upcoming manifest.
          </p>
        </section>

        <div className="space-y-3">
          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <Satellite className="size-4 text-ion" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">Tracked orbit groups</h2>
            </div>
            <div className="mt-3 space-y-2">
              {TLE_GROUPS.map((group) => (
                <div key={group.id} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink/85">{group.label}</p>
                    <p className="text-[10px] text-muted">{group.description}</p>
                  </div>
                  <span className="chip shrink-0">{group.id}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-muted/80">
              TLE sets are cached for six hours. Positions are approximate; never use them for
              navigation or collision avoidance.
            </p>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <Orbit className="size-4 text-plasma" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">How the layer works</h2>
            </div>
            <ol className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted">
              <li>1. Server proxies CelesTrak GP data and caches it.</li>
              <li>2. Browser calls satellite.js for every object each second.</li>
              <li>3. Positions are mapped as GeoJSON points on MapLibre.</li>
              <li>4. Clicking a satellite computes a 90-minute ground track.</li>
            </ol>
            <Link
              href="/launches"
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-ion hover:text-ink"
            >
              See the launch manifest <ExternalLink className="size-3" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
