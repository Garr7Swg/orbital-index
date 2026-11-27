import { NextResponse } from "next/server";
import { fetchTles, TLE_GROUP_IDS } from "@/lib/tle";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("groups") ?? "stations,visual,weather")
    .split(",")
    .map((group) => group.trim())
    .filter((group) => TLE_GROUP_IDS.includes(group));

  const groups = requested.length > 0 ? requested : ["stations"];
  const satellites = await fetchTles(groups);

  return NextResponse.json(
    {
      count: satellites.length,
      groups,
      fetchedAt: new Date().toISOString(),
      satellites,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
