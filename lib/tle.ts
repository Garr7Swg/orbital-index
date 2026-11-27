import { cacheGet, cacheSet } from "./cache";
import type { SatelliteGroup, TleRecord } from "./types";

export const TLE_GROUPS: SatelliteGroup[] = [
  { id: "stations", label: "Space stations", description: "Crewed orbital outposts" },
  { id: "visual", label: "Brightest 150", description: "Visible to the naked eye" },
  { id: "weather", label: "Weather", description: "Meteorological constellation" },
  { id: "gps-ops", label: "GPS", description: "Operational navigation birds" },
  { id: "science", label: "Science", description: "Research and observatories" },
];

export const TLE_GROUP_IDS = TLE_GROUPS.map((g) => g.id);

const CACHE_TTL = 6 * 60 * 60;

function parseTle(text: string, group: string): TleRecord[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  const out: TleRecord[] = [];
  let name: string | null = null;
  for (const line of lines) {
    if (line.startsWith("1 ") && line.length >= 60) {
      // line1 — the satellite name was captured on the previous iteration
      continue;
    }
    if (line.startsWith("2 ") && name) {
      continue;
    }
    name = line;
  }

  for (let i = 0; i < lines.length - 2; i += 1) {
    const [nameLine, line1, line2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (
      line1?.startsWith("1 ") &&
      line2?.startsWith("2 ") &&
      line1.length >= 60 &&
      line2.length >= 60
    ) {
      out.push({
        name: nameLine.trim(),
        noradId: line2.slice(2, 7).trim(),
        group,
        line1,
        line2,
      });
      i += 2;
    }
  }
  return out;
}

async function fetchGroup(group: string): Promise<TleRecord[]> {
  const key = `orbital:tle:${group}:v1`;
  const cached = await cacheGet<TleRecord[]>(key);
  if (cached && cached.length > 0) return cached;

  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "text/plain" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const records = parseTle(await res.text(), group);
    if (records.length > 0) await cacheSet(key, records, CACHE_TTL);
    return records;
  } catch {
    return [];
  }
}

export async function fetchTles(groups: string[]): Promise<TleRecord[]> {
  const safe = groups.filter((g) => TLE_GROUP_IDS.includes(g)).slice(0, 3);
  const batches = await Promise.all(safe.map(fetchGroup));
  return batches.flat();
}
