import { NextResponse } from "next/server";
import { cacheConfigured } from "@/lib/cache";
import { hasDatabase } from "@/lib/db";
import { getLaunchData } from "@/lib/store";
import { resolveSiteUrl, siteLabel } from "@/lib/site-url";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const site = resolveSiteUrl(new URL(request.url));

  // Warm the cache opportunistically: the boot overlay polls this endpoint and
  // waits for ready, so the first Launch Library 2 fetch starts here.
  const pending = getLaunchData().catch(() => null);

  const memory = (globalThis as unknown as { __orbitalSnapshot?: { upcoming: unknown[]; fetchedAt: string } })
    .__orbitalSnapshot;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
  const data = await Promise.race([pending, timeout]);

  const snapshot = data ?? memory;
  const launchCount = snapshot ? snapshot.upcoming.length : 0;

  return NextResponse.json(
    {
      ready: Boolean(snapshot && launchCount > 0),
      launchCount,
      fetchedAt: snapshot?.fetchedAt ?? null,
      integrations: {
        database: hasDatabase(),
        redis: cacheConfigured(),
        assistant: Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY),
        embeddings: Boolean(process.env.GEMINI_API_KEY),
        auth: supabaseConfigured(),
        ll2Key: Boolean(process.env.LL2_API_KEY),
      },
      siteUrl: site.origin,
      siteUrlSource: siteLabel(site.source),
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
