/**
 * Dev supervisor. `npm run dev` runs through this so the in-chat Restart button
 * (GET /api/dev/restart) can stop `next dev` and have it come straight back.
 *
 * Ctrl+C stops the supervisor and the server together.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const args = ["dev", "--hostname", "127.0.0.1", "--port", "3000"];

let child = null;
let stopping = false;

function start() {
  child = spawn(process.execPath, [nextBin, ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ORBITAL_SUPERVISED: "1" },
  });

  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(0);
    }
    console.log(`\n[dev] server exited (${signal ?? code}) — restarting in 500ms`);
    setTimeout(start, 500);
  });
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
    if (child) child.kill(signal);
    else process.exit(0);
  });
}

start();
