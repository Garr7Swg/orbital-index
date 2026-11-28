/**
 * Lists the models the configured Gemini and Groq keys can use. Dev helper only;
 * never prints key values.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const text = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
const env = {};
for (const line of text.split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

if (env.GEMINI_API_KEY) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}&pageSize=200`);
  const data = await res.json();
  const models = (data.models ?? []).map((m) => ({
    name: m.name.replace("models/", ""),
    methods: m.supportedGenerationMethods ?? [],
  }));
  console.log("GEMINI generateContent:",
    models.filter((m) => m.methods.includes("generateContent")).map((m) => m.name).join(", ") || "none");
  console.log("GEMINI embedContent:",
    models.filter((m) => m.methods.includes("embedContent")).map((m) => m.name).join(", ") || "none");
} else console.log("GEMINI: no key");

if (env.GROQ_API_KEY) {
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
  });
  const data = await res.json();
  console.log("GROQ models:", (data.data ?? []).map((m) => m.id).join(", ") || JSON.stringify(data).slice(0, 300));
} else console.log("GROQ: no key");
