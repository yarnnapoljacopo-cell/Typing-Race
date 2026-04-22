import * as esbuild from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  external: ["electron"],
  format: "cjs",
  sourcemap: false,
  minify: false,
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ["src/main.ts"],
    outfile: "build/main.js",
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["src/preload.ts"],
    outfile: "build/preload.js",
  }),
]);

console.log("Build complete.");
