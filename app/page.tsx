import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Database,
  Globe2,
  MapPinned,
  Orbit,
  Radio,
  Rocket,
  Sparkles,
  Trophy,
} from "lucide-react";
import { LaunchCharts } from "@/components/charts/LaunchCharts";
import { LaunchMap } from "@/components/map/LaunchMap";
import { Countdown } from "@/components/launches/Countdown";
import { LaunchMiniCard } from "@/components/launches/LaunchMiniCard";
import { ErrorPanel } from "@/components/system/ErrorPanel";
import { cacheConfigured } from "@/lib/cache";
import { hasDatabase } from "@/lib/db";
import { formatNet, statusTone } from "@/lib/format";
import { computePads, computeStats } from "@/lib/stats";
import { getLaunchData } from "@/lib/store";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className="text-ion/70">{icon}</span>
      </div>
      <p className="mt-2 font-mono text-2xl tabular-nums leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[11px] text-muted">{note}</p>
    </div>
  );
}

function SystemRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 py-2 last:border-0">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]">
        <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-500/60"}`} />
        <span className={ok ? "text-ink/80" : "text-muted/60"}>{value}</span>
      </span>
    </div>
  );
}

export default async function HomePage() {
  let data;
  try {
    data = await getLaunchData();
  } catch (error) {
    return <ErrorPanel detail={error instanceof Error ? error.message : undefined} />;
  }

  const stats = computeStats(data.upcoming, data.previous);
  const pads = computePads(data.upcoming);
  const next = stats.nextLaunch;
  const upcoming = data.upcoming.slice(0, 5);
  const sourceLabel =
    data.source === "database" ? "postgres snapshot" : data.source === "cache" ? "edge cache" : "live ll2";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="panel relative overflow-hidden">
        <div className="grid-veil" aria-hidden />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-emerald-400/25 text-emerald-300">
                <span className="size-1.5 animate-blink rounded-full bg-emerald-400" /> live feed
              </span>
              <span className="chip">launch library 2</span>
              <span className="chip">{sourceLabel}</span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl">
              Every launch.
              <br />
              Every orbit.
              <span className="text-gradient"> One index.</span>
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-[15px]">
              Live global launch schedule, interactive pad and satellite maps, launch analytics and
              an AI assistant that answers from the mission archive — not from thin air.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/launches" className="btn btn-primary text-xs sm:text-sm">
                <Rocket className="size-4" aria-hidden /> Browse launches
              </Link>
              <Link href="/map" className="btn text-xs sm:text-sm">
                <Globe2 className="size-4" aria-hidden /> Open live map
              </Link>
              <Link href="/assistant" className="btn text-xs sm:text-sm">
                <Sparkles className="size-4 text-ion" aria-hidden /> Ask the archive
              </Link>
            </div>

            <dl className="mt-7 grid max-w-md grid-cols-3 gap-4 border-t border-white/8 pt-4">
              <div>
                <dt className="eyebrow">scheduled</dt>
                <dd className="mt-1 font-mono text-lg text-ink">{stats.totals.upcoming}</dd>
              </div>
              <div>
                <dt className="eyebrow">sites</dt>
                <dd className="mt-1 font-mono text-lg text-ink">{stats.totals.pads}</dd>
              </div>
              <div>
                <dt className="eyebrow">providers</dt>
                <dd className="mt-1 font-mono text-lg text-ink">{stats.totals.providers}</dd>
              </div>
            </dl>
          </div>

          {next && (
            <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-abyss">
              {next.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={next.image}
                  alt=""
                  className="absolute inset-0 size-full object-cover opacity-45"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/20" />
              <div className="relative flex h-full flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow flex items-center gap-1.5">
                    <Radio className="size-3 text-ion" aria-hidden /> next lift-off
                  </span>
                  <span className={`chip border ${statusTone(next.statusAbbrev)}`}>
                    {next.statusAbbrev}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-semibold leading-snug text-ink sm:text-xl">
                  {next.name}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  <span>{next.provider}</span>
                  <span className="text-muted/40">·</span>
                  <span>{next.rocket}</span>
                  {next.orbitAbbrev && (
                    <>
                      <span className="text-muted/40">·</span>
                      <span>{next.orbitAbbrev}</span>
                    </>
                  )}
                </p>

                <div className="mt-6">
                  <Countdown net={next.net} />
                </div>

                <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
                  <p className="flex items-start gap-1.5 text-[11px] text-muted">
                    <CalendarClock className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {formatNet(next.net)}
                  </p>
                  <p className="flex items-start gap-1.5 text-[11px] text-muted">
                    <MapPinned className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {next.pad} — {next.padLocation || next.country || "Location TBD"}
                  </p>
                  <Link
                    href={`/launches?q=${encodeURIComponent(next.name)}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-ion hover:text-ink"
                  >
                    Mission brief <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          icon={<Rocket className="size-4" aria-hidden />}
          label="Upcoming launches"
          value={String(stats.totals.upcoming)}
          note="announced in the global manifest"
        />
        <Stat
          icon={<CalendarClock className="size-4" aria-hidden />}
          label="Next 30 days"
          value={String(stats.totals.next30)}
          note="scheduled lift-offs"
        />
        <Stat
          icon={<MapPinned className="size-4" aria-hidden />}
          label="Active launch sites"
          value={String(stats.totals.pads)}
          note="distinct pads on the map"
        />
        <Stat
          icon={<Globe2 className="size-4" aria-hidden />}
          label="Providers"
          value={String(stats.totals.providers)}
          note="agencies and companies"
        />
        <Stat
          icon={<Trophy className="size-4" aria-hidden />}
          label="Success rate"
          value={`${stats.totals.successRate}%`}
          note={`${stats.totals.completed} completed flights tracked`}
        />
      </section>

      {/* Map + systems */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <LaunchMap pads={pads} compact />
        </div>
        <div className="panel flex min-w-0 flex-col p-4">
          <p className="eyebrow flex items-center gap-1.5">
            <Database className="size-3" aria-hidden /> systems
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink">Data pipeline</h2>
          <div className="mt-3">
            <SystemRow
              label="Launch Library 2"
              value={process.env.LL2_API_KEY ? "keyed feed" : "public feed"}
              ok
            />
            <SystemRow
              label="Launch cache"
              value={hasDatabase() ? "postgres" : "in-memory"}
              ok
            />
            <SystemRow label="Upstash cache" value={cacheConfigured() ? "connected" : "off"} ok={cacheConfigured()} />
            <SystemRow
              label="Satellite TLEs"
              value="celestrak"
              ok
            />
            <SystemRow
              label="Assistant"
              value={process.env.GROQ_API_KEY ? "groq" : process.env.GEMINI_API_KEY ? "gemini" : "no key"}
              ok={Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)}
            />
            <SystemRow
              label="Semantic search"
              value={process.env.GEMINI_API_KEY ? "pgvector" : "keyword"}
              ok={Boolean(process.env.GEMINI_API_KEY)}
            />
            <SystemRow label="Accounts" value={supabaseConfigured() ? "supabase" : "off"} ok={supabaseConfigured()} />
          </div>

          <div className="mt-auto rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              cache warm · {data.fetchedAt.slice(11, 16)} UTC
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted/80">
              Free-tier stack: first requests can be slow, then responses come from Postgres or the
              edge cache. The schedule is re-polled every few minutes.
            </p>
            <Link
              href="/assistant"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-ion hover:text-ink"
            >
              <Sparkles className="size-3" aria-hidden /> Ask about this dataset
            </Link>
          </div>
        </div>
      </section>

      {/* Charts + upcoming */}
      <section className="grid gap-3 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <LaunchCharts stats={stats} />
        </div>
        <div className="panel min-w-0 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Manifest</p>
              <h2 className="mt-1 text-base font-semibold text-ink">Next off the pad</h2>
            </div>
            <Link
              href="/launches"
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:text-ion"
            >
              all <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {upcoming.map((launch) => (
              <LaunchMiniCard key={launch.id} launch={launch} />
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline explainer */}
      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            icon: <Radio className="size-4 text-ion" aria-hidden />,
            title: "Polled manifest",
            body: "A scheduled job pulls the global launch schedule from Launch Library 2 and upserts it into Postgres, so pages never wait on the upstream API.",
          },
          {
            icon: <Orbit className="size-4 text-plasma" aria-hidden />,
            title: "Orbits in your browser",
            body: "CelesTrak TLE sets are cached server-side, then satellite.js propagates every tracked object to your screen once a second — no position API required.",
          },
          {
            icon: <Sparkles className="size-4 text-solar" aria-hidden />,
            title: "Grounded answers",
            body: "The assistant calls retrieval functions against the same database, then answers with Groq or Gemini. Every claim links back to a launch record.",
          },
        ].map((item) => (
          <article key={item.title} className="panel min-w-0 p-4">
            <div className="flex items-center gap-2">
              {item.icon}
              <h3 className="text-sm font-medium text-ink">{item.title}</h3>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
