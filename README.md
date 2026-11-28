# Orbital Index

A dark-mode space launch intelligence dashboard: live launch manifest, interactive pad + satellite
maps, launch analytics, saved launches, and a retrieval-grounded AI assistant.

- **Frontend** — Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, MapLibre GL JS with
  OpenFreeMap tiles, ECharts, satellite.js.
- **Backend** — Next.js route handlers, optional Postgres (Supabase/Neon) with pgvector, optional
  Upstash Redis, scheduled Launch Library 2 polling via Vercel Cron or `node-cron`.
- **Data** — [Launch Library 2](https://thespacedevs.com/llapi) schedule, [CelesTrak](https://celestrak.org)
  TLE sets, [OpenFreeMap](https://openfreemap.org) map tiles.
- **Runtime** — Node.js 24 LTS (`.nvmrc`, `engines`).

Everything third-party is optional: with no environment variables the app still runs, caching
Launch Library 2 responses in process memory and CelesTrak TLEs in a short-lived cache.

## Quick start

```bash
nvm use            # Node 24
npm install
cp .env.example .env.local
npm run dev        # http://127.0.0.1:3000
```

## Local vs cloud URLs

The deployment URL is never hard-coded. `lib/site-url.ts` resolves the origin per request, so the
same build works on localhost, on Vercel preview URLs (which change with every deployment) and on a
production or custom domain:

| Environment | URL | Resolution |
| --- | --- | --- |
| Local dev | `http://127.0.0.1:3000` (`npm run dev` pins the port) | request origin |
| Local production | `PORT=3005 npm start` | request origin |
| Vercel preview | `https://<project>-<hash>-<team>.vercel.app` | request origin → `VERCEL_URL` |
| Vercel production | `https://<project>.vercel.app` | request origin → `VERCEL_URL` |
| Custom domain | `https://your-domain.com` | request origin, or set `NEXT_PUBLIC_SITE_URL` |

Precedence: `NEXT_PUBLIC_SITE_URL` → request origin → `VERCEL_URL` →
`VERCEL_PROJECT_PRODUCTION_URL` → `http://localhost:3000`. Vercel injects the two `VERCEL_*`
variables automatically; leave `NEXT_PUBLIC_SITE_URL` blank unless a proxy rewrites the origin.
`GET /api/health` returns the resolved `siteUrl` and `siteUrlSource`, which is the quickest way to
check what a deployment thinks its URL is.

**Supabase redirect allowlist** (Authentication → URL Configuration) must contain every origin the
app can run on:

```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
https://<project>.vercel.app/auth/callback
https://<custom-domain>/auth/callback
https://*-<team>.vercel.app/auth/callback   # optional: wildcard for previews
```

Set the Site URL to the production origin and keep localhost in the redirect list for development.

## Environment

| Variable | Purpose |
| --- | --- |
| `LL2_API_KEY` | Optional Launch Library 2 key (higher rate limit). Server-side only. |
| `LL2_BASE_URL` | Defaults to `https://ll.thespacedevs.com/2.3.0`. |
| `DATABASE_URL` | Supabase/Neon pooled Postgres URL. Enables persistence, watchlists, embeddings. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional shared response cache. |
| `GEMINI_API_KEY` | **Primary** chat model, plus 768-dim embeddings for pgvector search. |
| `GEMINI_CHAT_MODEL` / `GEMINI_EMBED_MODEL` | Default to `gemini-3.5-flash` / `gemini-embedding-001`. |
| `GROQ_API_KEY` | Fallback chat model (OpenAI-compatible Groq API), used when Gemini fails. |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b`. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enable sign-in with Supabase auth. |
| `CRON_SECRET` | Required bearer secret for `/api/cron/sync` in production. |
| `NEXT_PUBLIC_SITE_URL` | Optional origin override for auth redirects; blank = auto-detect (localhost / Vercel / custom domain). |

### Database

Apply `db/schema.sql` (optional — the app bootstraps it on first use). `CREATE EXTENSION vector`
succeeds on Supabase; on databases without pgvector the app falls back to keyword search.

### Scheduled polling

- **Vercel** — `vercel.json` triggers `/api/cron/sync` daily at 06:00 UTC (Hobby limit). Set
  `CRON_SECRET`; Vercel sends it as a bearer token.
- **Frequent polling** — run `APP_URL=http://127.0.0.1:3000 CRON_SECRET=… npm run poller` next to the dev server for a 5-minute cadence via `node-cron`.

Rate-limit math: each sync costs two Launch Library 2 requests. The public limit is roughly 15
requests/hour, so an unkeyed 5-minute poller will get throttled — set `LL2_API_KEY` (≈30/hour) or use
`POLL_CRON="*/20 * * * *"`. Cached reads mean normal page traffic never hits the upstream API.

## API

| Route | Description |
| --- | --- |
| `GET /api/launches` | Cached launch list with optional `scope`, `q`, `status`, `provider`, `limit`. |
| `GET /api/satellites?groups=stations,visual` | CelesTrak TLE proxy (6h cache). |
| `POST /api/assistant` | Chat with tool-calling over the launch store. |
| `GET /api/health` | Readiness + integration flags; warms the cache. |
| `GET /api/cron/sync` | Authorized Launch Library 2 poll. |
| `GET/POST /api/favorites` | Per-user watchlist (requires sign-in + Postgres). |

## Deploying to Vercel

1. Import the repo, framework preset **Next.js**, Node.js **24.x**.
2. Add the environment variables per environment (Production / Preview / Development):
   `DATABASE_URL`, `LL2_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `CRON_SECRET`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Leave `NEXT_PUBLIC_SITE_URL` blank.
3. Deploy, then add the resulting URLs to Supabase's redirect allowlist (see above).
4. `vercel.json` registers the daily cron; Vercel sends `CRON_SECRET` as a bearer token. For a
   five-minute cadence, run `npm run poller` on an always-on host instead.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier
npm run poller     # node-cron poller
```

## Notes

Launch data © The Space Devs (Launch Library 2), orbit elements © CelesTrak, map data
© OpenStreetMap contributors via OpenFreeMap. Satellite positions are approximate and must not be
used for navigation or collision avoidance.
