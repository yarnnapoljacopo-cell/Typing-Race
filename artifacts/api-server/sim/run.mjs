// Build + run the sprint-engine stress harness.
//   pnpm run stress
// Bundles sim/stress.ts (driving the real kartItems / gladiatorEngine /
// roomManager code) with a no-op @workspace/db stub, then runs it on node.
// NODE_ENV=production keeps the logger from spawning a worker thread.
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "stress.mjs");

await esbuild.build({
  entryPoints: [path.join(here, "stress.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: out,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias: { "@workspace/db": path.join(here, "db-stub.ts") },
  external: ["pg-native"],
});

await import(out);
