"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Bot, Loader2, Sparkles, User } from "lucide-react";
import { formatShort } from "@/lib/format";
import type { Citation } from "@/lib/ai/tools";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  tools?: string[];
  provider?: string;
  notice?: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "What launches are coming up in the next 14 days?",
  "Which providers have the busiest schedule right now?",
  "Show me missions heading to polar or sun-synchronous orbits.",
  "What is the launch success rate in the tracked history?",
  "Anything launching from Cape Canaveral soon?",
];

export function AssistantChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;

    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })).slice(-10),
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        citations?: Citation[];
        tools?: string[];
        provider?: string;
        notice?: string;
        error?: string;
      };
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.answer ?? data.error ?? "No answer was returned.",
          citations: data.citations,
          tools: data.tools,
          provider: data.provider,
          notice: data.notice,
          error: !res.ok,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: "The link to mission control dropped. Check your connection and try again.",
          error: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel flex h-[calc(100vh-190px)] min-h-[560px] flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full border border-ion/30 bg-ion/10">
          <Sparkles className="size-4 text-ion" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Mission Control assistant</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            grounded in your launch database · no free browsing
          </p>
        </div>
        <span
          className={`ml-auto chip ${
            configured ? "border-emerald-400/30 text-emerald-300" : "border-solar/30 text-solar"
          }`}
        >
          {configured ? "online" : "not configured"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
              <Bot className="size-6 text-ion" aria-hidden />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-ink">Ask the launch archive</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
              I answer from the cached Launch Library 2 records — mission names, vehicles, pads,
              orbits and statistics. Nothing outside your dataset is invented.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left text-xs leading-relaxed text-muted transition hover:border-ion/30 hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-ion/25 bg-ion/10">
                  <Bot className="size-3.5 text-ion" aria-hidden />
                </span>
              )}
              <div className={`max-w-[85%] ${message.role === "user" ? "order-first" : ""}`}>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-sm border border-ion/25 bg-ion/10 text-ink"
                      : message.error
                        ? "rounded-bl-sm border border-alert/25 bg-alert/8 text-alert"
                        : "rounded-bl-sm border border-white/8 bg-white/[0.03] text-ink/90"
                  }`}
                >
                  {message.content}
                </div>

                {message.citations && message.citations.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted/70">
                      retrieved records
                    </p>
                    {message.citations.map((citation) => (
                      <Link
                        key={citation.id}
                        href={`/launches?q=${encodeURIComponent(citation.name)}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[11px] transition hover:border-ion/25"
                      >
                        <span className="truncate text-ink/85">{citation.name}</span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                          {formatShort(citation.net)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {message.tools && message.tools.length > 0 && (
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted/60">
                    tools: {message.tools.join(" · ")}
                    {message.provider ? ` — ${message.provider}` : ""}
                  </p>
                )}
                {message.notice && (
                  <p className="mt-1 text-[10px] text-solar/80">{message.notice}</p>
                )}
              </div>
              {message.role === "user" && (
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5">
                  <User className="size-3.5 text-muted" aria-hidden />
                </span>
              )}
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-full border border-ion/25 bg-ion/10">
                <Bot className="size-3.5 text-ion" aria-hidden />
              </span>
              <span className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-muted">
                <Loader2 className="size-3.5 animate-spin text-ion" aria-hidden />
                querying launch database…
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form
        className="border-t border-white/8 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask about missions, vehicles, pads or launch stats…"
            className="field max-h-28 min-h-[42px] flex-1 resize-none py-2.5"
            aria-label="Message the assistant"
          />
          <button
            type="submit"
            disabled={pending || input.trim().length === 0}
            className="btn btn-primary size-[42px] shrink-0 p-0"
            aria-label="Send message"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted/60">
          Answers come only from retrieved launch records. Free models can still make mistakes —
          verify critical details.
        </p>
      </form>
    </div>
  );
}
