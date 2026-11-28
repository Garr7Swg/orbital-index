/**
 * Prints whether the Gemini and Groq keys in .env.local are accepted by their
 * APIs, without ever printing the key values. Dev helper only.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadEnv() {
  const text = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = await loadEnv();

async function probe(label, url, init) {
  const key = url.includes("generativelanguage") ? env.GEMINI_API_KEY : env.GROQ_API_KEY;
  if (!key) {
    console.log(`${label}: no key set`);
    return;
  }
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    console.log(`${label}: ${res.status} ${res.ok ? "OK" : body}`);
  } catch (error) {
    console.log(`${label}: request failed — ${error instanceof Error ? error.message : error}`);
  }
}

await probe(
  "gemini chat",
  `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_CHAT_MODEL || "gemini-2.0-flash"}:generateContent?key=${env.GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the word ok." }] }] }),
  },
);

await probe(
  "gemini embeddings",
  `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBED_MODEL || "gemini-embedding-001"}:embedContent?key=${env.GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text: "orbit" }] }, outputDimensionality: 768 }),
  },
);

await probe("groq chat", "https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "Reply with the word ok." }],
    max_tokens: 5,
  }),
});
