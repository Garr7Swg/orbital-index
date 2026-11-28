import type { Metadata } from "next";
import { Braces, Database, Search, Sparkles } from "lucide-react";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mission Control assistant — Orbital Index",
  description: "Ask questions about the launch archive, answered from retrieved database records.",
};

export default function AssistantPage() {
  const configured = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Retrieval assistant</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Ask the launch archive
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
            Function-calling over your cached Launch Library 2 data. The model cannot browse the
            web; it can only read the launches, pads and statistics it retrieves here.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">gemini chat</span>
          <span className="chip">groq fallback</span>
          <span className="chip">gemini embeddings</span>
          <span className="chip">{hasDatabase() ? "postgres" : "in-memory"}</span>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_290px]">
        <AssistantChat configured={configured} />

        <aside className="space-y-3">
          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-ion" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">Retrieval tools</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-muted">
              <li>
                <span className="font-mono text-[10px] text-ion/90">search_launches</span>
                <br />
                Semantic (pgvector) or keyword search across mission names, vehicles, providers and pads.
              </li>
              <li>
                <span className="font-mono text-[10px] text-ion/90">list_upcoming</span>
                <br />
                Schedule window queries with optional provider filter.
              </li>
              <li>
                <span className="font-mono text-[10px] text-ion/90">get_launch</span>
                <br />
                Full record for a single mission, including windows and probability.
              </li>
              <li>
                <span className="font-mono text-[10px] text-ion/90">launch_stats</span>
                <br />
                Aggregated cadence, provider, orbit and status statistics.
              </li>
            </ul>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-plasma" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">Fallback chain</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Chat tries Gemini first, then Groq if Gemini is rate-limited or missing. Embeddings always
              come from Gemini. Without any key the archive still works — only the chat is offline.
            </p>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-solar/20 bg-solar/[0.05] p-2.5">
              <Braces className="size-3.5 shrink-0 text-solar" aria-hidden />
              <p className="text-[10px] leading-relaxed text-solar/85">
                Set <span className="font-mono">GEMINI_API_KEY</span> as the primary chat key and{" "}
                <span className="font-mono">GROQ_API_KEY</span> as the fallback.
              </p>
            </div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-solar" aria-hidden />
              <h2 className="text-sm font-semibold text-ink">Ask well</h2>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Specific questions retrieve better records: name a provider, orbit, region or time
              window. Answers cite the launches they used.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
