import type { Citation } from "./tools";
import { runTool, toCitations, toolSpecs } from "./tools";
import type { LaunchSummary } from "../types";
import { TLE_GROUPS } from "../tle";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  answer: string;
  citations: Citation[];
  provider: "groq" | "gemini" | "none";
  tools: string[];
  notice?: string;
}

const SYSTEM_PROMPT = `You are Orbital Index Mission Control, an assistant embedded in a space launch tracking dashboard.

Rules:
- Answer ONLY from the data returned by your tools. Never invent launches, dates, providers or statistics.
- Always call a tool before answering a factual question. Prefer search_launches for topics and list_upcoming for schedules.
- Give dates in UTC, concisely (e.g. "28 Nov 2026, 14:30 UTC"). Today is ${new Date().toISOString().slice(0, 10)}.
- Keep answers under 180 words, use short bullets, and name the missions you reference.
- If a tool returns no results, say so plainly and suggest a broader query.
- The satellite tracker covers these groups: ${TLE_GROUPS.map((g) => g.label).join(", ")}. If asked about spacecraft that are not in the launch database, say that you can only speak to tracked launches.`;

export async function answer(history: ChatMessage[]): Promise<AssistantReply> {
  const messages = history
    .filter((m) => m.content.trim().length > 0)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));

  if (messages.length === 0) {
    return {
      answer: "Ask me about upcoming launches, providers, orbits or launch statistics.",
      citations: [],
      provider: "none",
      tools: [],
    };
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await runGroq(messages);
    } catch (error) {
      console.error("[assistant] Groq failed", error);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const reply = await runGemini(messages);
      return {
        ...reply,
        notice: process.env.GROQ_API_KEY ? "Groq is unavailable — answering with Gemini." : undefined,
      };
    } catch (error) {
      console.error("[assistant] Gemini failed", error);
    }
  }

  return {
    answer:
      "The AI assistant is not configured yet. Add GROQ_API_KEY (chat) and/or GEMINI_API_KEY (embeddings) to your environment and redeploy. Everything else in the dashboard works without them.",
    citations: [],
    provider: "none",
    tools: [],
  };
}

/* ---------------------------------- Groq ---------------------------------- */

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

async function runGroq(history: ChatMessage[]): Promise<AssistantReply> {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const messages: GroqMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const collected: LaunchSummary[] = [];
  const toolsSeen = new Set<string>();
  let answerText = "";

  for (let round = 0; round < 4; round += 1) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        messages,
        tools: toolSpecs,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = (await res.json()) as {
      choices: { message: { content: string | null; tool_calls?: GroqMessage["tool_calls"] } }[];
    };
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("Groq returned an empty message");

    if (message.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      });
      for (const call of message.tool_calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        toolsSeen.add(call.function.name);
        const outcome = await runTool(call.function.name, parsed);
        collected.push(...outcome.launches);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: outcome.text.slice(0, 6000),
        });
      }
      continue;
    }

    answerText = message.content?.trim() ?? "";
    break;
  }

  return {
    answer:
      answerText ||
      "I couldn't finish that lookup. Try a more specific question about a mission or provider.",
    citations: toCitations(collected),
    provider: "groq",
    tools: [...toolsSeen],
  };
}

/* --------------------------------- Gemini --------------------------------- */

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

async function runGemini(history: ChatMessage[]): Promise<AssistantReply> {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const collected: LaunchSummary[] = [];
  const toolsSeen = new Set<string>();

  const declarations = toolSpecs.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));

  let answerText = "";
  for (let round = 0; round < 4; round += 1) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          tools: [{ functionDeclarations: declarations }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    answerText = parts
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();

    if (calls.length === 0) break;

    contents.push({ role: "model", parts });
    const responses: GeminiPart[] = [];
    for (const call of calls) {
      const name = call.functionCall!.name;
      toolsSeen.add(name);
      const outcome = await runTool(name, call.functionCall!.args ?? {});
      collected.push(...outcome.launches);
      let parsed: unknown;
      try {
        parsed = JSON.parse(outcome.text);
      } catch {
        parsed = { result: outcome.text };
      }
      responses.push({
        functionResponse: {
          name,
          response: { result: parsed },
        },
      });
    }
    contents.push({ role: "user", parts: responses });
  }

  return {
    answer: answerText || "I couldn't finish that lookup. Try rephrasing your question.",
    citations: toCitations(collected),
    provider: "gemini",
    tools: [...toolsSeen],
  };
}
