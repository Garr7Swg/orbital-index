/** Gemini embeddings (free tier). Returns null when the key is missing or the call fails. */
const MODEL = process.env.GEMINI_EMBED_MODEL || "text-embedding-004";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

export function embeddingsConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || texts.length === 0) return null;

  try {
    const res = await fetch(`${ENDPOINT}/models/${MODEL}:batchEmbedContents?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text: text.slice(0, 4000) }] },
        })),
      }),
    });
    if (!res.ok) {
      console.error("[embeddings] Gemini responded", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { embeddings?: { values: number[] }[] };
    if (!data.embeddings) return null;
    return data.embeddings.map((e) => e.values);
  } catch (error) {
    console.error("[embeddings] request failed", error);
    return null;
  }
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const [vector] = (await embedTexts([text])) ?? [];
  return vector ?? null;
}
