import { db, ensureSchema, hasDatabase, hasVector } from "../db";
import { computeStats } from "../stats";
import {
  getLaunchById,
  getLaunchData,
  keywordSearchLaunches,
} from "../store";
import type { LaunchSummary } from "../types";

export interface Citation {
  id: string;
  name: string;
  net: string;
  provider: string;
  rocket: string;
  status: string;
  pad: string;
}

export interface ToolOutcome {
  text: string;
  launches: LaunchSummary[];
}

export const toolSpecs = [
  {
    type: "function" as const,
    function: {
      name: "search_launches",
      description:
        "Search the launch database by free-text topic (mission, rocket, provider, place, orbit) and optional filters. Use this for any question about specific launches.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free-text search, e.g. 'lunar lander', 'Starlink', 'Cape Canaveral'.",
          },
          status: {
            type: "string",
            description: "Filter by status abbreviation, e.g. Go, TBD, Success, Failure.",
          },
          provider: { type: "string", description: "Launch provider name, partial match." },
          limit: { type: "number", description: "Maximum results, 1-20. Default 8." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_launch",
      description: "Fetch one launch record in full detail by its Launch Library 2 id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Launch id (UUID)." } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_upcoming",
      description: "List upcoming launches within a number of days, optionally by provider.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Look-ahead window in days. Default 30." },
          provider: { type: "string", description: "Optional provider name filter." },
          limit: { type: "number", description: "Maximum results, 1-20. Default 10." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "launch_stats",
      description:
        "Aggregate launch statistics from the local database: totals, cadence by month, top providers, orbit distribution, status mix.",
      parameters: {
        type: "object",
        properties: {
          group_by: {
            type: "string",
            description: "One of: overview, provider, orbit, month, status.",
          },
        },
        required: ["group_by"],
      },
    },
  },
] as const;

function summarize(launch: LaunchSummary) {
  return {
    id: launch.id,
    name: launch.name,
    net: launch.net,
    status: launch.statusAbbrev,
    provider: launch.provider,
    rocket: launch.rocket,
    mission: launch.mission,
    orbit: launch.orbit,
    pad: launch.pad,
    location: launch.padLocation,
    country: launch.country,
  };
}

async function semanticSearch(query: string, limit: number): Promise<LaunchSummary[] | null> {
  if (!(await hasVector())) return null;
  const { embedQuery } = await import("./embeddings");
  const vector = await embedQuery(query);
  if (!vector) return null;
  try {
    await ensureSchema();
    const literal = `[${vector.join(",")}]`;
    const rows = await db()<{ payload: LaunchSummary }[]>`
      select l.payload
      from launch_embeddings e
      join launches l on l.id = e.launch_id
      order by e.embedding <=> ${literal}::vector
      limit ${limit}
    `;
    return rows.map((r) => r.payload);
  } catch {
    return null;
  }
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  const str = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
  const num = (key: string, fallback: number) => {
    const n = Number(args[key]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  if (name === "search_launches") {
    const query = str("query").trim();
    const limit = Math.min(num("limit", 8), 20);
    const status = str("status").trim();
    const provider = str("provider").trim();

    const semantic = query ? await semanticSearch(query, limit * 2) : null;
    let launches = semantic ?? (await keywordSearchLaunches(query, { status, provider, limit }));
    if (semantic) {
      launches = launches.filter(
        (l) =>
          (!status || l.statusAbbrev === status) &&
          (!provider || l.provider.toLowerCase().includes(provider.toLowerCase())),
      );
    }
    launches = launches.slice(0, limit);

    if (launches.length === 0) {
      return {
        text: `No launches matched "${query || "the filters"}"${status ? ` with status ${status}` : ""}.`,
        launches: [],
      };
    }
    return {
      text: JSON.stringify(
        { retrieval: semantic ? "semantic+pgvector" : "keyword", results: launches.map(summarize) },
        null,
        2,
      ),
      launches,
    };
  }

  if (name === "get_launch") {
    const launch = await getLaunchById(str("id"));
    if (!launch) return { text: "No launch found with that id.", launches: [] };
    return {
      text: JSON.stringify(
        {
          ...summarize(launch),
          windowStart: launch.windowStart,
          windowEnd: launch.windowEnd,
          probability: launch.probability,
          missionType: launch.missionType,
        },
        null,
        2,
      ),
      launches: [launch],
    };
  }

  if (name === "list_upcoming") {
    const days = Math.min(num("days", 30), 365);
    const limit = Math.min(num("limit", 10), 20);
    const provider = str("provider").trim().toLowerCase();
    const data = await getLaunchData();
    const cutoff = Date.now() + days * 86_400_000;
    const launches = data.upcoming
      .filter((l) => Date.parse(l.net) <= cutoff)
      .filter((l) => !provider || l.provider.toLowerCase().includes(provider))
      .slice(0, limit);
    return {
      text:
        launches.length > 0
          ? JSON.stringify({ window_days: days, results: launches.map(summarize) }, null, 2)
          : `No launches scheduled in the next ${days} days${provider ? ` for ${provider}` : ""}.`,
      launches,
    };
  }

  if (name === "launch_stats") {
    const data = await getLaunchData();
    const stats = computeStats(data.upcoming, data.previous);
    const groupBy = str("group_by") || "overview";
    const payload =
      groupBy === "provider"
        ? { providers: stats.providers }
        : groupBy === "orbit"
          ? { orbits: stats.orbits }
          : groupBy === "month"
            ? { monthly: stats.monthly }
            : groupBy === "status"
              ? { statuses: stats.statuses }
              : { totals: stats.totals, providers: stats.providers.slice(0, 5) };
    return {
      text: JSON.stringify({ dataset: groupBy, source: data.source, ...payload }, null, 2),
      launches: [],
    };
  }

  return { text: `Unknown tool: ${name}`, launches: [] };
}

export function toCitations(launches: LaunchSummary[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const launch of launches) {
    if (seen.has(launch.id)) continue;
    seen.add(launch.id);
    out.push({
      id: launch.id,
      name: launch.name,
      net: launch.net,
      provider: launch.provider,
      rocket: launch.rocket,
      status: launch.statusAbbrev,
      pad: launch.pad,
    });
    if (out.length >= 6) break;
  }
  return out;
}

export function dataSources() {
  return {
    database: hasDatabase(),
    vector: false,
  };
}
