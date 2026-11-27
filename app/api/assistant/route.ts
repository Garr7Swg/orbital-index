import { NextResponse } from "next/server";
import { answer, type ChatMessage } from "@/lib/ai/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Small in-memory guard so the free AI quotas are not drained by a single tab. */
const hits = new Map<string, { count: number; reset: number }>();
const LIMIT = 30;
const WINDOW = 60 * 60 * 1000;

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  entry.count += 1;
  if (hits.size > 500) {
    for (const [key, value] of hits) if (value.reset < now) hits.delete(key);
  }
  return entry.count > LIMIT;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many assistant requests. Try again in a little while." },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? (body.messages as ChatMessage[])
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0,
        )
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }))
    : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  try {
    const reply = await answer(messages);
    return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[assistant] route error", error);
    return NextResponse.json(
      { answer: "Mission control lost the link. Please try again.", citations: [], provider: "none", tools: [] },
      { status: 200 },
    );
  }
}
