/**
 * MapLibre 6 ships its worker as a separate ESM file. Turbopack does not emit it
 * for `new Worker(new URL(...))`, so we serve the self-contained worker from
 * /public and register it with setWorkerUrl() in the map component.
 */
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const target = join(root, "public", "maplibre", "maplibre-gl-worker.mjs");

try {
  const [srcStat, dstStat] = await Promise.all([
    stat(source),
    stat(target).catch(() => null),
  ]);
  if (dstStat && dstStat.size === srcStat.size) {
    const [a, b] = await Promise.all([readFile(source), readFile(target)]);
    if (a.equals(b)) process.exit(0);
  }
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`[maplibre] worker copied → public/maplibre/maplibre-gl-worker.mjs`);
} catch (error) {
  console.warn(`[maplibre] could not copy worker: ${error instanceof Error ? error.message : error}`);
}
