-- Orbital Index schema (Supabase or Neon Postgres).
-- The app bootstraps this lazily; running it manually is optional.

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

-- pgvector: available on Supabase. Skip this block on databases without it.
create extension if not exists vector;
create table if not exists launch_embeddings (
  launch_id text primary key,
  embedding vector(768) not null,
  updated_at timestamptz not null default now()
);
create index if not exists launch_embeddings_ivfflat
  on launch_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 20);
