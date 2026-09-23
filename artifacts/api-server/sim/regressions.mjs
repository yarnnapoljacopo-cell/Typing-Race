import esbuild from "esbuild";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
const here = import.meta.dirname;
const out = path.join(here, "../dist/regressions.mjs");
await esbuild.build({
  entryPoints: [path.join(here, "regressions.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  define: { "import.meta.env.DEV": "false", "import.meta.env.BASE_URL": '"/"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  alias: { "@workspace/db": path.join(here, "regression-db.ts") },
  external: ["bcrypt", "pg-native"],
});
await import(pathToFileURL(out).href);
