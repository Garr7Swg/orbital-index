export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-void/60">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-8 text-xs text-muted sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ion/70">
            Orbital Index
          </span>
          <span>
            Launch data{" "}
            <a
              className="text-ink/80 underline decoration-white/20 underline-offset-2 hover:text-ion"
              href="https://thespacedevs.com/llapi"
              target="_blank"
              rel="noreferrer"
            >
              Launch Library 2
            </a>{" "}
            / The Space Devs
          </span>
          <span>
            Orbits{" "}
            <a
              className="text-ink/80 underline decoration-white/20 underline-offset-2 hover:text-ion"
              href="https://celestrak.org"
              target="_blank"
              rel="noreferrer"
            >
              CelesTrak
            </a>
          </span>
          <span>
            Maps{" "}
            <a
              className="text-ink/80 underline decoration-white/20 underline-offset-2 hover:text-ion"
              href="https://openfreemap.org"
              target="_blank"
              rel="noreferrer"
            >
              OpenFreeMap
            </a>{" "}
            · © OpenStreetMap contributors
          </span>
        </div>
        <p className="text-[11px] text-muted/70">
          Satellite positions are computed in your browser from public TLEs and are approximate —
          do not use for navigation or collision avoidance. Not affiliated with any space agency.
        </p>
      </div>
    </footer>
  );
}
