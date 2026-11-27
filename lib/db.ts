import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __orbitalSql?: Sql };

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!globalForDb.__orbitalSql) {
    // Supabase, Neon and most managed hosts expect TLS; a local Postgres does
    // not. Honour an explicit sslmode in the URL, otherwise require TLS for
    // any non-loopback host.
    const explicitSslMode = /[?&]sslmode=/i.test(url);
    const isLoopback = /@(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);
    globalForDb.__orbitalSql = postgres(url, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      // Required for Supabase / pgbouncer transaction pooling.
      prepare: false,
      ...(!explicitSslMode && !isLoopback ? { ssl: "require" as const } : {}),
    });
  }
  return globalForDb.__orbitalSql;
}

const SCHEMA = `
create table if not exists launches (
  id text primary key,
  net timestamptz not null,
  status text,
  provider text,
  orbit text,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists launches_net_idx on launches (net desc);
create index if not exists launches_provider_idx on launches (provider);

create table if not exists favorites (
  user_id text not null,
  launch_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, launch_id)
);

create table if not exists sync_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  upcoming int,
  previous int,
  embedded int,
  ok boolean,
  detail text
);
`;

const globalForSchema = globalThis as unknown as {
  __orbitalSchema?: Promise<{ vector: boolean }>;
};

async function createSchema(): Promise<{ vector: boolean }> {
  const sql = db();
  await sql.unsafe(SCHEMA);
  let vector = false;
  try {
    await sql.unsafe("create extension if not exists vector");
    await sql.unsafe(
      `create table if not exists launch_embeddings (
         launch_id text primary key,
         embedding vector(768) not null,
         updated_at timestamptz not null default now()
       )`,
    );
    await sql.unsafe(
      "create index if not exists launch_embeddings_ivfflat on launch_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 20)",
    );
    vector = true;
  } catch {
    // pgvector is unavailable on some free tiers; keyword search still works.
    vector = false;
  }
  return { vector };
}

export function ensureSchema(): Promise<{ vector: boolean }> {
  if (!globalForSchema.__orbitalSchema) {
    globalForSchema.__orbitalSchema = createSchema().catch((error) => {
      globalForSchema.__orbitalSchema = undefined;
      throw error;
    });
  }
  return globalForSchema.__orbitalSchema;
}

export async function hasVector(): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    return (await ensureSchema()).vector;
  } catch {
    return false;
  }
}

export type { Sql };
