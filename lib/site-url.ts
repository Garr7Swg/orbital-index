export type SiteUrlSource =
  | "env"
  | "request"
  | "vercel-deployment"
  | "vercel-production"
  | "localhost";

function normalize(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const candidate = raw.includes("://")
      ? raw
      : `${raw.startsWith("localhost") || raw.startsWith("127.0.0.1") ? "http" : "https"}://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Resolves the absolute origin used for auth redirects and links.
 *
 * Order:
 *  1. NEXT_PUBLIC_SITE_URL — explicit override (custom domain behind a proxy).
 *  2. The incoming request origin — localhost, Vercel preview URLs, custom domains.
 *  3. VERCEL_URL — the current deployment host.
 *  4. VERCEL_PROJECT_PRODUCTION_URL — the project's production host.
 *  5. http://localhost:3000.
 *
 * This keeps localhost, preview deployments and production on one code path with
 * no hard-coded domain.
 */
export function resolveSiteUrl(requestUrl?: URL | string): {
  origin: string;
  source: SiteUrlSource;
} {
  const explicit = normalize(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return { origin: explicit, source: "env" };

  const fromRequest = requestUrl ? normalize(typeof requestUrl === "string" ? requestUrl : requestUrl.origin) : null;
  if (fromRequest) return { origin: fromRequest, source: "request" };

  const deployment = normalize(process.env.VERCEL_URL);
  if (deployment) return { origin: deployment, source: "vercel-deployment" };

  const production = normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return { origin: production, source: "vercel-production" };

  return { origin: "http://localhost:3000", source: "localhost" };
}

export function siteLabel(source: SiteUrlSource) {
  switch (source) {
    case "env":
      return "env override";
    case "request":
      return "request origin";
    case "vercel-deployment":
      return "vercel deployment";
    case "vercel-production":
      return "vercel production";
    default:
      return "localhost";
  }
}
