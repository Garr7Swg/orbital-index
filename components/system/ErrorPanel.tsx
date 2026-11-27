import { RefreshCw, TriangleAlert } from "lucide-react";

export function ErrorPanel({ detail }: { detail?: string }) {
  return (
    <div className="panel mx-auto mt-10 max-w-xl p-8 text-center">
      <TriangleAlert className="mx-auto size-8 text-solar" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-ink">Telemetry link is down</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Launch Library 2 did not respond. Free-tier rate limits reset hourly — the dashboard will
        recover on the next poll.
      </p>
      {detail && (
        <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] p-2 font-mono text-[10px] text-muted/80">
          {detail}
        </p>
      )}
      <a href="" className="btn btn-primary mt-5 text-xs">
        <RefreshCw className="size-3.5" aria-hidden /> Retry now
      </a>
    </div>
  );
}
