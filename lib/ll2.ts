import type { LaunchSummary } from "./types";

const BASE = (process.env.LL2_BASE_URL || "https://ll.thespacedevs.com/2.3.0").replace(/\/$/, "");

interface RawLaunch {
  id: string;
  name: string;
  slug?: string;
  net: string;
  window_start?: string | null;
  window_end?: string | null;
  probability?: number | null;
  status?: { name?: string; abbrev?: string } | null;
  launch_service_provider?: { name?: string; type?: { name?: string } | string } | null;
  rocket?: { configuration?: { full_name?: string; family?: string } | null } | null;
  mission?: {
    name?: string;
    type?: string;
    orbit?: { name?: string; abbrev?: string } | null;
  } | null;
  pad?: {
    name?: string;
    latitude?: string | number | null;
    longitude?: string | number | null;
    map_url?: string | null;
    location?: { name?: string } | null;
    country?: { name?: string } | null;
  } | null;
  image?: { image_url?: string | null } | null;
  vidURLs?: { url?: string; priority?: number }[] | null;
  webcast_live?: boolean;
  infographic?: string | null;
  url?: string;
}

export class Ll2Error extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "Ll2Error";
    this.status = status;
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLaunch(raw: RawLaunch): LaunchSummary {
  const providerType =
    typeof raw.launch_service_provider?.type === "string"
      ? raw.launch_service_provider.type
      : (raw.launch_service_provider?.type?.name ?? "Unknown");
  const webcast =
    raw.vidURLs?.find((v) => v.url)?.url ??
    (raw.webcast_live ? "https://www.youtube.com/results?search_query=live+rocket+launch" : null);

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug ?? raw.id,
    net: raw.net,
    windowStart: raw.window_start ?? null,
    windowEnd: raw.window_end ?? null,
    status: raw.status?.name ?? "Unknown",
    statusAbbrev: raw.status?.abbrev ?? "TBD",
    provider: raw.launch_service_provider?.name ?? "Unknown provider",
    providerType,
    rocket: raw.rocket?.configuration?.full_name ?? "Unknown vehicle",
    rocketFamily: raw.rocket?.configuration?.family ?? "",
    mission: raw.mission?.name ?? "",
    missionType: raw.mission?.type ?? "",
    orbit: raw.mission?.orbit?.name ?? "",
    orbitAbbrev: raw.mission?.orbit?.abbrev ?? "",
    pad: raw.pad?.name ?? "Unknown pad",
    padLocation: raw.pad?.location?.name ?? "",
    lat: toNumber(raw.pad?.latitude),
    lng: toNumber(raw.pad?.longitude),
    country: raw.pad?.country?.name ?? "",
    image: raw.image?.image_url ?? null,
    webcast,
    infoUrl: raw.url ?? null,
    probability: typeof raw.probability === "number" ? raw.probability : null,
    updatedAt: new Date().toISOString(),
  };
}

async function ll2Fetch(path: string, attempt = 0): Promise<{ count: number; results: RawLaunch[] }> {
  const key = process.env.LL2_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers.Authorization = `Token ${key}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new Ll2Error(
      error instanceof Error && error.name === "TimeoutError"
        ? "Launch Library 2 timed out"
        : "Could not reach Launch Library 2",
      504,
    );
  }

  if (res.status === 429 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    return ll2Fetch(path, attempt + 1);
  }
  if (!res.ok) {
    throw new Ll2Error(`Launch Library 2 responded ${res.status}`, res.status);
  }
  const data = (await res.json()) as { count?: number; results?: RawLaunch[] };
  return { count: data.count ?? 0, results: data.results ?? [] };
}

const FIELDS = [
  "id",
  "name",
  "slug",
  "net",
  "window_start",
  "window_end",
  "probability",
  "status",
  "launch_service_provider",
  "rocket",
  "mission",
  "pad",
  "image",
  "vidURLs",
  "webcast_live",
  "url",
  "infographic",
].join(",");

export async function fetchUpcoming(limit = 100): Promise<LaunchSummary[]> {
  const { results } = await ll2Fetch(
    `/launches/upcoming/?limit=${limit}&mode=detailed&fields=${FIELDS}`,
  );
  return results.map(normalizeLaunch).sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
}

export async function fetchPrevious(limit = 100, monthsBack = 12): Promise<LaunchSummary[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const { results } = await ll2Fetch(
    `/launches/previous/?limit=${limit}&mode=detailed&ordering=-net&net__gte=${since.toISOString()}&fields=${FIELDS}`,
  );
  return results.map(normalizeLaunch).sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
}

export async function fetchLaunchById(id: string): Promise<LaunchSummary | null> {
  try {
    const res = await fetch(`${BASE}/launches/${encodeURIComponent(id)}/?mode=detailed`, {
      headers: process.env.LL2_API_KEY
        ? { Authorization: `Token ${process.env.LL2_API_KEY}`, Accept: "application/json" }
        : { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return normalizeLaunch((await res.json()) as RawLaunch);
  } catch {
    return null;
  }
}

export function ll2Configured() {
  return true;
}
