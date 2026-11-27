"use client";

import { useEffect, useState } from "react";
import { timeUntil } from "@/lib/format";

const CELLS: { key: "days" | "hours" | "minutes" | "seconds"; label: string }[] = [
  { key: "days", label: "days" },
  { key: "hours", label: "hrs" },
  { key: "minutes", label: "min" },
  { key: "seconds", label: "sec" },
];

export function Countdown({ net, compact = false }: { net: string; compact?: boolean }) {
  const [parts, setParts] = useState<ReturnType<typeof timeUntil> | null>(null);

  useEffect(() => {
    const tick = () => setParts(timeUntil(net));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [net]);

  if (!parts) {
    return (
      <span className="font-mono text-xs tracking-[0.18em] text-muted/70">--:--:--</span>
    );
  }

  if (parts.past) {
    return (
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-emerald-300/90">
        window opened
      </span>
    );
  }

  return (
    <div className={`flex items-end gap-1 ${compact ? "" : "gap-2"}`}>
      {CELLS.map(({ key, label }, index) => (
        <div key={key} className="flex items-end gap-1">
          <div className="text-center">
            <div
              className={`font-mono tabular-nums leading-none ${
                compact ? "text-sm text-ink" : "text-2xl text-ink sm:text-3xl"
              }`}
            >
              {String(parts[key]).padStart(key === "days" ? 1 : 2, "0")}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-muted/70">{label}</div>
          </div>
          {index < CELLS.length - 1 && (
            <span className={`pb-3 text-muted/40 ${compact ? "text-[10px]" : "text-sm"}`}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}
