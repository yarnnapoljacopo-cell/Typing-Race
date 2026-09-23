import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(new URL("../../api-server/package.json", import.meta.url));
const { build } = require("esbuild");
const temp = await mkdtemp(path.join(tmpdir(), "writing-regressions-"));
try {
  // The app tsconfig excludes sim/. Compile the browser suite here as well so
  // fixture syntax errors are caught before browser verification.
  await build({ entryPoints: [new URL("./connection-regressions.tsx", import.meta.url).pathname],
    bundle: true, write: false, platform: "browser", format: "esm", jsx: "automatic",
    loader: { ".css": "empty" }, define: { "import.meta.env.DEV": "false", "import.meta.env.BASE_URL": '"/"' } });
  const output = path.join(temp, "tests.cjs");
  await build({ entryPoints: [new URL("./writing-regressions.tsx", import.meta.url).pathname], outfile: output,
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", loader: { ".css": "empty" },
    define: { "import.meta.env.DEV": "false", "import.meta.env.BASE_URL": '"/"' } });
  require(output);
} finally { await rm(temp, { recursive: true, force: true }); }
