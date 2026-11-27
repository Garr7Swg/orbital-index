import type { DashboardStats, LaunchSummary, PadPoint } from "./types";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function completedBefore(l: LaunchSummary, cutoff: number) {
  const t = Date.parse(l.net);
  return t < cutoff;
}

export function computeStats(upcoming: LaunchSummary[], previous: LaunchSummary[]): DashboardStats {
  const now = Date.now();
  const next30 = now + 30 * 24 * 60 * 60 * 1000;
  const successStatuses = new Set(["Success", "Success", "Launch Successful"]);
  const completed = previous.filter((l) => completedBefore(l, now));
  const resolved = completed.filter((l) => l.statusAbbrev !== "TBD" && l.statusAbbrev !== "In Flight");
  const successes = resolved.filter(
    (l) => successStatuses.has(l.status) || l.statusAbbrev === "Success",
  );

  const monthBuckets = new Map<string, { label: string; time: number; launches: number }>();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, {
      label: MONTH.format(d),
      time: d.getTime(),
      launches: 0,
    });
  }
  for (const launch of [...completed, ...upcoming]) {
    const d = new Date(launch.net);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key);
    if (bucket) bucket.launches += 1;
  }

  const countBy = (items: LaunchSummary[], pick: (l: LaunchSummary) => string) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = pick(item).trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const statusCounts = new Map<string, number>();
  for (const launch of [...upcoming, ...completed]) {
    const key = launch.statusAbbrev || "Unknown";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }

  const pads = new Set(upcoming.map((l) => `${l.pad}|${l.lat}|${l.lng}`));
  const sortedUpcoming = [...upcoming].sort((a, b) => Date.parse(a.net) - Date.parse(b.net));

  return {
    totals: {
      upcoming: upcoming.length,
      next30: upcoming.filter((l) => Date.parse(l.net) <= next30).length,
      completed: completed.length,
      successRate:
        resolved.length > 0 ? Math.round((successes.length / resolved.length) * 1000) / 10 : 0,
      pads: pads.size,
      providers: new Set(upcoming.map((l) => l.provider)).size,
    },
    monthly: [...monthBuckets.values()]
      .sort((a, b) => a.time - b.time)
      .map((b) => ({ month: b.label, launches: b.launches })),
    providers: countBy(upcoming, (l) => l.provider).slice(0, 8),
    orbits: countBy(upcoming, (l) => l.orbitAbbrev || l.orbit || "Unknown").slice(0, 7),
    statuses: [...statusCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    nextLaunch: sortedUpcoming[0] ?? null,
  };
}

export function computePads(launches: LaunchSummary[]): PadPoint[] {
  const pads = new Map<string, PadPoint>();
  const sorted = [...launches].sort((a, b) => Date.parse(a.net) - Date.parse(b.net));

  for (const launch of sorted) {
    if (launch.lat === null || launch.lng === null) continue;
    const key = `${launch.pad}|${launch.lat.toFixed(3)}|${launch.lng.toFixed(3)}`;
    const existing = pads.get(key);
    if (existing) {
      existing.launches += 1;
      continue;
    }
    pads.set(key, {
      id: key,
      name: launch.pad,
      location: launch.padLocation,
      country: launch.country,
      lat: launch.lat,
      lng: launch.lng,
      launches: 1,
      next: {
        id: launch.id,
        name: launch.name,
        net: launch.net,
        status: launch.statusAbbrev,
      },
    });
  }
  return [...pads.values()].sort((a, b) => b.launches - a.launches);
}
