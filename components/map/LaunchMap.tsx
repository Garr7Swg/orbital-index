"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import * as satellite from "satellite.js";
import type { Feature, FeatureCollection, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Loader2, Locate, SatelliteIcon } from "lucide-react";
import type { PadPoint, TleRecord } from "@/lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const GROUP_COLORS: Record<string, string> = {
  stations: "#6ee7ff",
  visual: "#fbbf24",
  weather: "#8b93ff",
  "gps-ops": "#34d399",
  science: "#f472b6",
};

type SatFeature = Feature<Point, { noradId: string; name: string; group: string; alt: number }>;

function satPosition(record: TleRecord, satrec: satellite.SatRec, date: Date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position) return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  const lat = satellite.degreesLat(geo.latitude);
  const lng = satellite.degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, alt: geo.height, record };
}

function popupNode(title: string, rows: [string, string][]) {
  const root = document.createElement("div");
  root.style.minWidth = "180px";
  root.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.cssText = "font-size:13px;font-weight:600;color:#e7edff;margin-bottom:6px;";
  root.appendChild(heading);

  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;justify-content:space-between;gap:14px;font-size:11px;color:#8f9bba;padding:1.5px 0;";
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement("span");
    val.textContent = value;
    val.style.color = "#dbe4ff";
    val.style.textAlign = "right";
    row.append(key, val);
    root.appendChild(row);
  }
  return root;
}

export function LaunchMap({
  pads,
  compact = false,
}: {
  pads: PadPoint[];
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sats, setSats] = useState<TleRecord[]>([]);
  const [satGroups, setSatGroups] = useState<string[]>(["stations", "visual", "weather"]);
  const [showSats, setShowSats] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [loadingSats, setLoadingSats] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [clock, setClock] = useState("--:--:--");
  const satsRef = useRef<TleRecord[]>([]);
  const showSatsRef = useRef(true);
  const showLabelsRef = useRef(false);

  const satrecs = useMemo(() => {
    const map = new Map<string, satellite.SatRec>();
    for (const record of sats) {
      try {
        map.set(record.noradId, satellite.twoline2satrec(record.line1, record.line2));
      } catch {
        // Skip malformed elements.
      }
    }
    return map;
  }, [sats]);

  const satrecsRef = useRef(satrecs);
  useEffect(() => {
    satrecsRef.current = satrecs;
    satsRef.current = sats;
  }, [satrecs, sats]);

  useEffect(() => {
    showSatsRef.current = showSats;
  }, [showSats]);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  const padGeoJson = useMemo<FeatureCollection<Point, { name: string; launches: number }>>(
    () => ({
      type: "FeatureCollection",
      features: pads.map((pad) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pad.lng, pad.lat] },
        properties: { name: pad.name, launches: pad.launches },
      })),
    }),
    [pads],
  );

  const buildSatFeatures = useCallback((): FeatureCollection<Point> => {
    const now = new Date();
    const features: SatFeature[] = [];
    for (const record of satsRef.current) {
      const rec = satrecsRef.current.get(record.noradId);
      if (!rec) continue;
      try {
        const pos = satPosition(record, rec, now);
        if (!pos) continue;
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
          properties: { noradId: record.noradId, name: record.name, group: record.group, alt: pos.alt },
        });
      } catch {
        // Ignore propagation failures for individual birds.
      }
    }
    return { type: "FeatureCollection", features };
  }, []);

  const drawGroundTrack = useCallback((noradId: string) => {
    const map = mapRef.current;
    const record = satsRef.current.find((s) => s.noradId === noradId);
    const rec = satrecsRef.current.get(noradId);
    if (!map || !record || !rec) return;

    const start = new Date();
    const coords: [number, number][] = [];
    for (let i = 0; i <= 90; i += 1) {
      const when = new Date(start.getTime() + i * 60_000);
      try {
        const pos = satPosition(record, rec, when);
        if (pos) coords.push([pos.lng, pos.lat]);
      } catch {
        // ignore
      }
    }
    // Split at the antimeridian so the line does not wrap the whole planet.
    const segments: [number, number][][] = [];
    let current: [number, number][] = [];
    for (const point of coords) {
      const previous = current[current.length - 1];
      if (previous && Math.abs(previous[0] - point[0]) > 180) {
        if (current.length > 1) segments.push(current);
        current = [];
      }
      current.push(point);
    }
    if (current.length > 1) segments.push(current);

    const source = map.getSource("groundtrack") as GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: segments.map((segment) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: segment },
        properties: {},
      })),
    } as FeatureCollection);
  }, []);

  /* ------------------------------- map mount ------------------------------- */
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    // The worker lives in /public (see scripts/sync-maplibre-worker.mjs) because
    // bundlers cannot reliably emit MapLibre's separate worker module.
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: STYLE_URL,
        center: [12, 24],
        zoom: compact ? 1.25 : 1.6,
        minZoom: 1,
        maxZoom: 12,
        attributionControl: false,
        dragRotate: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Map failed to initialise";
      requestAnimationFrame(() => setError(message));
      return;
    }
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __orbitalMap?: MapLibreMap }).__orbitalMap = map;
    }
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      map.addSource("pads", {
        type: "geojson",
        data: padGeoJson,
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 4,
      });
      map.addLayer({
        id: "pad-glow",
        type: "circle",
        source: "pads",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "launches"], 1, 9, 20, 22],
          "circle-color": "#6ee7ff",
          "circle-opacity": 0.14,
          "circle-blur": 1,
        },
      });
      map.addLayer({
        id: "pad-points",
        type: "circle",
        source: "pads",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "launches"], 1, 3.5, 20, 9],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "launches"],
            1,
            "#8b93ff",
            10,
            "#6ee7ff",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(230,240,255,0.75)",
        },
      });
      map.addLayer({
        id: "pad-clusters",
        type: "circle",
        source: "pads",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 12, 5, 16, 12, 20],
          "circle-color": "rgba(110,231,255,0.18)",
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(110,231,255,0.55)",
        },
      });
      map.addLayer({
        id: "pad-cluster-count",
        type: "symbol",
        source: "pads",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 10,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#d9fbff" },
      });

      map.addSource("sats", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sat-dots",
        type: "circle",
        source: "sats",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2, 6, 4],
          "circle-color": [
            "match",
            ["get", "group"],
            "stations",
            GROUP_COLORS.stations,
            "visual",
            GROUP_COLORS.visual,
            "weather",
            GROUP_COLORS.weather,
            "gps-ops",
            GROUP_COLORS["gps-ops"],
            "science",
            GROUP_COLORS.science,
            "#dbe4ff",
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(4,5,12,0.8)",
        },
      });
      map.addLayer({
        id: "sat-labels",
        type: "symbol",
        source: "sats",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          visibility: "none",
        },
        paint: { "text-color": "rgba(219,228,255,0.85)", "text-halo-color": "#04050c", "text-halo-width": 1 },
      });

      map.addSource("groundtrack", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "groundtrack-line",
        type: "line",
        source: "groundtrack",
        paint: {
          "line-color": "#6ee7ff",
          "line-width": 1.4,
          "line-opacity": 0.85,
          "line-dasharray": [2, 2],
        },
      });

      map.on("click", "pad-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const coords = (feature.geometry as Point).coordinates as [number, number];
        const pad = pads.find(
          (p) => Math.abs(p.lng - coords[0]) < 0.01 && Math.abs(p.lat - coords[1]) < 0.01,
        );
        if (!pad) return;
        new Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(coords)
          .setDOMContent(
            popupNode(pad.name, [
              ["Location", pad.location || pad.country || "—"],
              ["Launches tracked", String(pad.launches)],
              ["Next", pad.next?.status ?? "—"],
            ]),
          )
          .addTo(map);
      });

      map.on("click", "pad-clusters", async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id as number;
        const source = map.getSource("pads") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: (feature.geometry as Point).coordinates as [number, number], zoom });
      });

      map.on("click", "sat-dots", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties ?? {};
        const coords = (feature.geometry as Point).coordinates as [number, number];
        const alt = Number(props.alt ?? 0);
        new Popup({ closeButton: true, maxWidth: "280px" })
          .setLngLat(coords)
          .setDOMContent(
            popupNode(String(props.name ?? "Satellite"), [
              ["NORAD", String(props.noradId ?? "—")],
              ["Group", String(props.group ?? "—")],
              ["Altitude", `${alt.toFixed(0)} km`],
              ["Position", `${coords[1].toFixed(2)}°, ${coords[0].toFixed(2)}°`],
            ]),
          )
          .addTo(map);

        if (showLabelsRef.current) {
          const source = map.getSource("sats") as GeoJSONSource;
          source?.setData(buildSatFeatures());
        }
        drawGroundTrack(String(props.noradId));
      });

      for (const layer of ["pad-points", "pad-clusters", "sat-dots"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setReady(true);
    });

    map.on("error", (event) => {
      const message = event.error?.message;
      if (message && !message.includes("Failed to fetch")) setError(message);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map instance is created once; overlays are updated by separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const source = map?.getSource("pads") as GeoJSONSource | undefined;
    source?.setData(padGeoJson);
  }, [padGeoJson, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    map?.setLayoutProperty("sat-labels", "visibility", showLabels ? "visible" : "none");
  }, [showLabels, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    map.setLayoutProperty("sat-dots", "visibility", showSats ? "visible" : "none");
    map.setLayoutProperty("sat-labels", "visibility", showSats && showLabels ? "visible" : "none");
    if (!showSats) {
      (map.getSource("sats") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, [showSats, showLabels, ready]);

  /* --------------------------- live satellite loop -------------------------- */
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      const source = map.getSource("sats") as GeoJSONSource | undefined;
      if (!source) return;
      if (showSatsRef.current && satsRef.current.length > 0) {
        const data = buildSatFeatures();
        source.setData(data);
        setLiveCount(data.features.length);
      }
      setClock(new Date().toISOString().slice(11, 19));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, buildSatFeatures]);

  /* ------------------------------- TLE loading ------------------------------ */
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/satellites?groups=${satGroups.join(",")}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { satellites?: TleRecord[] }) => {
        setSats(data.satellites ?? []);
      })
      .catch(() => {
        /* aborted or offline — keep previous set */
      })
      .finally(() => setLoadingSats(false));
    return () => controller.abort();
  }, [satGroups]);

  const toggleGroup = (group: string) => {
    setLoadingSats(true);
    setSatGroups((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  };

  const flyToPad = (pad: PadPoint) => {
    mapRef.current?.flyTo({ center: [pad.lng, pad.lat], zoom: 6, duration: 1400 });
  };

  return (
    <div className="panel relative overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-3 py-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ion">
          <SatelliteIcon className="size-3.5" aria-hidden />
          live orbit layer
        </span>
        <span className="chip border-emerald-400/25 text-emerald-300">
          {showSats ? `${liveCount} tracked` : "hidden"}
        </span>
        <span className="chip">{clock} UTC</span>
        {loadingSats && (
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <Loader2 className="size-3 animate-spin" aria-hidden /> syncing TLEs
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSats((v) => !v)}
            className={`chip cursor-pointer transition ${
              showSats ? "border-ion/40 text-ion" : "hover:text-ink"
            }`}
            aria-pressed={showSats}
          >
            <Layers className="size-3" aria-hidden /> satellites
          </button>
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            className={`chip cursor-pointer transition ${
              showLabels ? "border-ion/40 text-ion" : "hover:text-ink"
            }`}
            aria-pressed={showLabels}
          >
            labels
          </button>
        </div>
      </div>

      <div className={`relative w-full ${compact ? "h-[360px]" : "h-[540px]"}`}>
        <div ref={container} className="absolute inset-0" />

        {error && (
          <div className="absolute inset-x-3 top-3 rounded-lg border border-alert/30 bg-alert/10 p-2.5 text-[11px] text-alert">
            Map tiles unavailable: {error}
          </div>
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
          <div className="rounded-lg border border-white/10 bg-void/75 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted backdrop-blur">
            {pads.length} launch sites · {sats.length} objects
          </div>
          <div className="pointer-events-auto flex flex-wrap gap-1">
            {Object.keys(GROUP_COLORS).map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => toggleGroup(group)}
                className={`chip cursor-pointer backdrop-blur transition ${
                  satGroups.includes(group)
                    ? "border-white/20 bg-void/60 text-ink"
                    : "bg-void/40 text-muted/60 hover:text-muted"
                }`}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: GROUP_COLORS[group] }}
                />
                {group}
              </button>
            ))}
          </div>
        </div>

        {!compact && pads.length > 0 && (
          <div className="absolute bottom-3 left-3 max-w-[240px] rounded-lg border border-white/10 bg-void/80 p-2 backdrop-blur">
            <p className="eyebrow mb-1.5 flex items-center gap-1">
              <Locate className="size-3" aria-hidden /> jump to site
            </p>
            <div className="max-h-28 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
              {pads.slice(0, 14).map((pad) => (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => flyToPad(pad)}
                  className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-muted transition hover:bg-white/8 hover:text-ink"
                >
                  {pad.name}
                  <span className="ml-1 font-mono text-[9px] text-muted/60">×{pad.launches}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 right-2 font-mono text-[9px] text-muted/70">
          ©{" "}
          <a
            className="pointer-events-auto underline"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>{" "}
          · OpenFreeMap · TLE CelesTrak
        </div>
      </div>
    </div>
  );
}
