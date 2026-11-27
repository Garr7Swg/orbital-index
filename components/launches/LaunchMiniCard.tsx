import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Countdown } from "./Countdown";
import { formatShort, statusTone } from "@/lib/format";
import type { LaunchSummary } from "@/lib/types";

export function LaunchMiniCard({ launch }: { launch: LaunchSummary }) {
  return (
    <Link
      href={`/launches?q=${encodeURIComponent(launch.name)}`}
      className="panel panel-interactive group flex gap-3 overflow-hidden p-3"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-abyss">
        {launch.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={launch.image}
            alt=""
            loading="lazy"
            className="size-full object-cover opacity-80 transition group-hover:opacity-100"
          />
        ) : (
          <div className="grid size-full place-items-center font-mono text-[10px] text-muted">
            no img
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`chip border ${statusTone(launch.statusAbbrev)}`}>
            {launch.statusAbbrev}
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {formatShort(launch.net)}
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-ion">
          {launch.name}
        </h3>
        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted">
          <MapPin className="size-3 shrink-0" aria-hidden />
          {launch.pad} · {launch.padLocation || launch.country || "Location TBD"}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <Countdown net={launch.net} compact />
          <ArrowUpRight className="size-3.5 text-muted/50 transition group-hover:text-ion" aria-hidden />
        </div>
      </div>
    </Link>
  );
}
