import { NextResponse } from "next/server";
import { computePads, computeStats } from "@/lib/stats";
import { getLaunchData } from "@/lib/store";
import type { LaunchSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 200);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "";
  const provider = url.searchParams.get("provider") ?? "";

  try {
    const data = await getLaunchData();
    let launches: LaunchSummary[] =
      scope === "upcoming" ? data.upcoming : scope === "previous" ? data.previous : [...data.upcoming, ...data.previous];

    if (q) {
      launches = launches.filter((l) =>
        [l.name, l.mission, l.provider, l.rocket, l.orbit, l.pad, l.padLocation, l.country]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (status) launches = launches.filter((l) => l.statusAbbrev === status);
    if (provider) launches = launches.filter((l) => l.provider === provider);

    return NextResponse.json(
      {
        source: data.source,
        fetchedAt: data.fetchedAt,
        count: launches.length,
        launches: launches.slice(0, limit),
        stats: computeStats(data.upcoming, data.previous),
        pads: computePads(data.upcoming),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Launch Library 2 is unreachable right now.",
        detail: error instanceof Error ? error.message : String(error),
        launches: [],
      },
      { status: 503 },
    );
  }
}
