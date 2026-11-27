#!/usr/bin/env node
/**
 * Frequent local / self-hosted poller.
 *
 * Vercel Hobby cron can only run once per day, so run this alongside `npm run dev`
 * (or on a small always-on box) to keep the launch cache fresh every five minutes:
 *
 *   APP_URL=http://127.0.0.1:3000 CRON_SECRET=... npm run poller
 */
import cron from "node-cron";

const base = process.env.APP_URL || "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET || "";
const interval = process.env.POLL_CRON || "*/5 * * * *";

async function sync() {
  const url = new URL("/api/cron/sync", base);
  const headers = secret ? { Authorization: `Bearer ${secret}` } : {};
  const started = Date.now();
  try {
    const res = await fetch(url, { headers });
    const body = await res.text();
    console.log(
      `[poller] ${new Date().toISOString()} ${res.status} in ${Date.now() - started}ms — ${body.slice(0, 240)}`,
    );
  } catch (error) {
    console.error(`[poller] sync failed: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`[poller] every "${interval}" → ${base}/api/cron/sync`);
await sync();
cron.schedule(interval, sync);
