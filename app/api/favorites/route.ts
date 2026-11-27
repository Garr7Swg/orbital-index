import { NextResponse } from "next/server";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const ids = await listFavorites(user.id);
  return NextResponse.json({ favorites: ids }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { launchId?: string; action?: string };
  try {
    body = (await request.json()) as { launchId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const launchId = body.launchId?.trim();
  if (!launchId) return NextResponse.json({ error: "launchId is required" }, { status: 400 });

  try {
    if (body.action === "remove") {
      await removeFavorite(user.id, launchId);
    } else {
      await addFavorite(user.id, launchId);
    }
    const ids = await listFavorites(user.id);
    return NextResponse.json({ favorites: ids });
  } catch {
    return NextResponse.json(
      { error: "Saving launches needs a Postgres connection (DATABASE_URL or POSTGRES_URL)." },
      { status: 503 },
    );
  }
}
