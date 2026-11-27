"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, CircleAlert, Rocket } from "lucide-react";

const STEPS = [
  "Contacting Launch Library 2",
  "Pulling completed launch history",
  "Requesting CelesTrak orbit elements",
  "Assembling mission telemetry",
];

export function BootOverlay() {
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(6);
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    started.current = Date.now();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function close() {
      setFading(true);
      document.body.style.overflow = previousOverflow;
      setTimeout(() => setHidden(true), 520);
    }

    async function poll() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as { ready?: boolean };
        if (cancelled) return;
        setProgress((p) => Math.min(94, p + 16));
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
        if (data.ready) {
          setProgress(100);
          setStep(STEPS.length - 1);
          document.body.style.overflow = previousOverflow;
          setTimeout(() => {
            if (!cancelled) close();
          }, 650);
          return;
        }
      } catch {
        if (cancelled) return;
        setFailed(true);
      }

      if (Date.now() - started.current > 18_000) setSlow(true);
      timer = setTimeout(poll, 2400);
    }

    // Let the loading theater breathe, but never hold the user hostage.
    timer = setTimeout(poll, 500);
    const escape = setTimeout(() => {
      if (!cancelled) setFailed(true);
    }, 26_000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(escape);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-void/92 px-4 backdrop-blur-xl transition-opacity duration-500 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="grid-veil absolute inset-0" aria-hidden />
      <div className="panel relative w-full max-w-xl overflow-hidden p-7 sm:p-9">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ion/70 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="relative grid size-16 shrink-0 place-items-center">
            <span className="absolute inset-0 rounded-full border border-ion/25" />
            <span className="absolute inset-2 rounded-full border border-plasma/30" />
            <span className="absolute inset-0 animate-orbit rounded-full border border-transparent border-t-ion/80" />
            <Rocket className="size-6 text-ion" aria-hidden />
          </div>
          <div>
            <p className="eyebrow">Orbital Index</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Establishing telemetry link
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          The dashboard is assembling live launch, pad and orbit data.
        </p>

        <div className="mt-5 rounded-xl border border-solar/25 bg-solar/[0.06] p-3.5">
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-solar" aria-hidden />
            <p className="text-[13px] leading-relaxed text-solar/90">
              <span className="font-semibold">Free-tier warning:</span> this deployment runs on free
              hosting and free APIs. The first load can take{" "}
              <span className="font-semibold">20–60 seconds</span> while caches warm up. Later visits
              are instant.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-ion" aria-hidden />
              {failed && progress < 40 ? "Retrying link" : STEPS[step]}
            </span>
            <span className="text-ion">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ion to-plasma transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`chip transition-colors ${
                  index <= step ? "border-ion/30 text-ion/90" : "border-white/8 text-muted/60"
                }`}
              >
                {index < step ? "●" : "○"} {label}
              </span>
            ))}
          </div>
        </div>

        {slow && (
          <p className="mt-4 text-xs text-muted">
            Still waiting on free-tier resources — cached data is being served where possible.
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
            ll2 · celestrak · openfreemap
          </p>
          <button type="button" onClick={() => setHidden(true)} className="btn text-xs">
            Skip animation
          </button>
        </div>
      </div>
    </div>
  );
}
