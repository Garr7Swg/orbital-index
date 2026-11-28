import { NextResponse } from "next/server";

/**
 * Development-only restart hook for the "Restart app" button in the chat.
 * Exits the dev server process; scripts/dev-supervisor.mjs brings it back.
 * Never available in a production build.
 */
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (process.env.ORBITAL_SUPERVISED !== "1") {
    return NextResponse.json(
      {
        restarting: false,
        error:
          "The dev server is not running under the supervisor. Start it with `npm run dev` so restarts are automatic.",
      },
      { status: 409 },
    );
  }

  // Let the response flush before the process goes away.
  setTimeout(() => process.exit(0), 250);

  return NextResponse.json({ restarting: true }, { headers: { "Cache-Control": "no-store" } });
}
