import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "../package.json");

const type = process.argv[2];
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: pnpm run version <patch|minor|major>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const parts = pkg.version.split(".").map(Number);

if (type === "major") { parts[0]++; parts[1] = 0; parts[2] = 0; }
else if (type === "minor") { parts[1]++; parts[2] = 0; }
else { parts[2]++; }

const next = parts.join(".");
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const tag = `v${next}`;

try {
  execSync("git add package.json", { stdio: "inherit" });
  execSync(`git commit -m "chore: release ${tag}"`, { stdio: "inherit" });
  execSync(`git tag ${tag}`, { stdio: "inherit" });

  console.log(`\n✓ Version bumped to ${tag}`);
  console.log("  Run the following to trigger the release workflow:");
  console.log(`\n  git push && git push origin ${tag}\n`);
} catch (err) {
  console.error("\nGit step failed. Version was bumped in package.json.");
  console.error("Commit and tag manually:\n");
  console.error(`  git add artifacts/desktop-app/package.json`);
  console.error(`  git commit -m "chore: release ${tag}"`);
  console.error(`  git tag ${tag}`);
  console.error(`  git push && git push origin ${tag}\n`);
  process.exit(1);
}
