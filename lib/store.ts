import { cacheGet, cacheSet } from "./cache";
import { db, ensureSchema, hasDatabase } from "./db";
import { fetchPrevious, fetchUpcoming, Ll2Error } from "./ll2";
import type { LaunchSummary, SyncResult } from "./types";

const CACHE_KEY = "orbital:launches:v3";
const MEMORY_TTL_MS = 10 * 60 * 1000;
const DB_TTL_MS = 5 * 60 * 1000;

export interface Snapshot {
  upcoming: LaunchSummary[];
  previous: LaunchSummary[];
  fetchedAt: string;
  source: "database" | "cache" | "live";
}

const g = globalThis as unknown as {
  __orbitalSnapshot?: Snapshot;
  __orbitalRefresh?: Promise<Snapshot>;
  __orbitalCooldownUntil?: number;
  __orbitalLastError?: string;
};

function fresh(snapshot: Snapshot | undefined, ttl: number): snapshot is Snapshot {
  return Boolean(snapshot && Date.now() - Date.parse(snapshot.fetchedAt) < ttl);
}

function remember(snapshot: Snapshot) {
  g.__orbitalSnapshot = snapshot;
}

/** Pull fresh data from Launch Library 2 and persist it everywhere we can. */
export async function refreshLaunches(reason = "manual"): Promise<SyncResult> {
  const ranAt = new Date().toISOString();
  let upcoming: LaunchSummary[] = [];
  let previous: LaunchSummary[] = [];
  try {
    const [next, past] = await Promise.all([fetchUpcoming(60), fetchPrevious(60)]);
    upcoming = next;
    previous = past;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Launch Library 2 error";
    // Back off after an upstream failure so page loads (and the boot overlay)
    // fail fast instead of hammering a throttled free-tier API.
    const throttled = error instanceof Ll2Error && error.status === 429;
    g.__orbitalCooldownUntil = Date.now() + (throttled ? 5 * 60_000 : 60_000);
    g.__orbitalLastError = throttled
      ? "Launch Library 2 is rate-limiting this deployment (429). Cached data is served when available; retrying automatically."
      : detail;
    await recordSync({ upcoming: 0, previous: 0, embedded: 0, ok: false, detail });
    return {
      ok: false,
      upcoming: upcoming.length,
      previous: previous.length,
      embedded: 0,
      stored: false,
      detail,
      ranAt,
    };
  }

  const snapshot: Snapshot = {
    upcoming,
    previous,
    fetchedAt: ranAt,
    source: "live",
  };
  g.__orbitalCooldownUntil = undefined;
  g.__orbitalLastError = undefined;
  remember(snapshot);
  await cacheSet(CACHE_KEY, snapshot, 900);

  let stored = false;
  let embedded = 0;
  if (hasDatabase()) {
    try {
      await ensureSchema();
      const sql = db();
      const rows = [...upcoming, ...previous].map((launch) => ({
        id: launch.id,
        net: launch.net,
        status: launch.status,
        provider: launch.provider,
        orbit: launch.orbit,
        payload: launch,
      }));
      // Upsert in chunks so a large payload stays inside statement limits.
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        await sql`
          insert into launches ${sql(chunk, "id", "net", "status", "provider", "orbit", "payload")}
          on conflict (id) do update set
            net = excluded.net,
            status = excluded.status,
            provider = excluded.provider,
            orbit = excluded.orbit,
            payload = excluded.payload,
            updated_at = now()
        `;
      }
      stored = true;
      embedded = await indexEmbeddings([...upcoming, ...previous]);
    } catch (error) {
      console.error("[store] database sync failed", error);
    }
  }

  await recordSync({
    upcoming: upcoming.length,
    previous: previous.length,
    embedded,
    ok: true,
    detail: `${reason}: ${upcoming.length} upcoming / ${previous.length} past`,
  });

  return {
    ok: true,
    upcoming: upcoming.length,
    previous: previous.length,
    embedded,
    stored,
    detail: `${upcoming.length} upcoming, ${previous.length} completed launch records refreshed.`,
    ranAt,
  };
}

async function recordSync(input: {
  upcoming: number;
  previous: number;
  embedded: number;
  ok: boolean;
  detail: string;
}) {
  if (!hasDatabase()) return;
  try {
    await ensureSchema();
    await db()`
      insert into sync_runs (upcoming, previous, embedded, ok, detail)
      values (${input.upcoming}, ${input.previous}, ${input.embedded}, ${input.ok}, ${input.detail})
    `;
  } catch {
    // Logging failures must not break the refresh.
  }
}

async function readFromDatabase(): Promise<Snapshot | null> {
  try {
    await ensureSchema();
    const sql = db();
    const rows = await sql<{ payload: LaunchSummary }[]>`
      select payload from launches order by net asc limit 400
    `;
    if (rows.length === 0) return null;
    const launches = rows.map((row) => row.payload);
    const now = Date.now();
    return {
      upcoming: launches.filter((l) => Date.parse(l.net) >= now),
      previous: launches.filter((l) => Date.parse(l.net) < now),
      fetchedAt: new Date().toISOString(),
      source: "database",
    };
  } catch (error) {
    console.error("[store] database read failed", error);
    return null;
  }
}

async function dedupeRefresh(): Promise<Snapshot> {
  if (g.__orbitalRefresh) return g.__orbitalRefresh;
  g.__orbitalRefresh = (async () => {
    try {
      await refreshLaunches("background");
      const snapshot = g.__orbitalSnapshot;
      if (snapshot) return snapshot;
      throw new Error(g.__orbitalLastError ?? "Launch refresh produced no data");
    } finally {
      g.__orbitalRefresh = undefined;
    }
  })();
  return g.__orbitalRefresh;
}

/**
 * UK-style resilient read path: memory → Postgres → Redis → live LL2.
 * The site keeps serving stale-but-real data if a free tier is cold or throttled.
 */
export async function getLaunchData(force = false): Promise<Snapshot> {
  const ttl = hasDatabase() ? DB_TTL_MS : MEMORY_TTL_MS;
  if (!force && fresh(g.__orbitalSnapshot, ttl)) return g.__orbitalSnapshot;

  if (!force && (g.__orbitalCooldownUntil ?? 0) > Date.now()) {
    if (g.__orbitalSnapshot) return g.__orbitalSnapshot;
    throw new Error(g.__orbitalLastError ?? "Launch Library 2 is unavailable; retrying shortly.");
  }

  if (hasDatabase()) {
    const fromDb = await readFromDatabase();
    if (fromDb) {
      remember(fromDb);
      return fromDb;
    }
  }

  if (!force) {
    const cached = await cacheGet<Snapshot>(CACHE_KEY);
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < MEMORY_TTL_MS) {
      const snapshot: Snapshot = { ...cached, source: "cache" };
      remember(snapshot);
      return snapshot;
    }
  }

  try {
    return await dedupeRefresh();
  } catch (error) {
    const stale = g.__orbitalSnapshot;
    if (stale) return stale;
    throw error;
  }
}

export async function getLaunchById(id: string): Promise<LaunchSummary | null> {
  if (hasDatabase()) {
    try {
      await ensureSchema();
      const rows = await db()<{ payload: LaunchSummary }[]>`
        select payload from launches where id = ${id} limit 1
      `;
      if (rows[0]) return rows[0].payload;
    } catch {
      // fall through to the live snapshot
    }
  }
  const data = await getLaunchData();
  return [...data.upcoming, ...data.previous].find((l) => l.id === id) ?? null;
}

/** Keyword search directly against Postgres when available, otherwise in memory. */
export async function keywordSearchLaunches(
  query: string,
  opts: { status?: string; provider?: string; limit?: number } = {},
): Promise<LaunchSummary[]> {
  const limit = Math.min(opts.limit ?? 20, 50);
  if (hasDatabase()) {
    try {
      await ensureSchema();
      const like = `%${query}%`;
      const rows = await db()<{ payload: LaunchSummary }[]>`
        select payload from launches
        where (
          ${query} = '' or
          payload->>'name' ilike ${like} or
          payload->>'mission' ilike ${like} or
          payload->>'provider' ilike ${like} or
          payload->>'rocket' ilike ${like} or
          payload->>'orbit' ilike ${like} or
          payload->>'pad' ilike ${like} or
          payload->>'padLocation' ilike ${like}
        )
        and (${opts.status ?? ""} = '' or payload->>'statusAbbrev' = ${opts.status ?? ""})
        and (${opts.provider ?? ""} = '' or payload->>'provider' ilike ${`%${opts.provider ?? ""}%`})
        order by net asc
        limit ${limit}
      `;
      return rows.map((r) => r.payload);
    } catch (error) {
      console.error("[store] keyword search failed", error);
    }
  }
  const data = await getLaunchData();
  const q = query.toLowerCase();
  return [...data.upcoming, ...data.previous]
    .filter((l) => {
      if (opts.status && l.statusAbbrev !== opts.status) return false;
      if (opts.provider && !l.provider.toLowerCase().includes(opts.provider.toLowerCase()))
        return false;
      if (!q) return true;
      return [l.name, l.mission, l.provider, l.rocket, l.orbit, l.pad, l.padLocation]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .slice(0, limit);
}

async function indexEmbeddings(launches: LaunchSummary[]): Promise<number> {
  const { embedTexts } = await import("./ai/embeddings");
  const { hasVector } = await import("./db");
  if (!(await hasVector())) return 0;

  const sample = launches.slice(0, 80);
  const texts = sample.map(
    (l) => `${l.name}. ${l.provider} ${l.rocket}. ${l.mission}. Orbit: ${l.orbit}. Pad: ${l.pad}, ${l.padLocation}. Status: ${l.status}.`,
  );
  const vectors = await embedTexts(texts);
  if (!vectors) return 0;

  let count = 0;
  try {
    const sql = db();
    for (let i = 0; i < sample.length; i += 20) {
      const chunk = sample.slice(i, i + 20);
      const values = chunk.map((launch, j) => ({
        launch_id: launch.id,
        embedding: `[${(vectors[i + j] ?? []).join(",")}]`,
      }));
      if (values.every((v) => v.embedding.length > 4)) {
        await sql`
          insert into launch_embeddings ${sql(values, "launch_id", "embedding")}
          on conflict (launch_id) do update set embedding = excluded.embedding, updated_at = now()
        `;
        count += values.length;
      }
    }
  } catch (error) {
    console.error("[store] embedding index failed", error);
  }
  return count;
}
