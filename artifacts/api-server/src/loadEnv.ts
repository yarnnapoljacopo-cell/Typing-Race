import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

// Evaluate before app/db imports: they read configuration at module load time.
try {
  loadEnvFile(resolve(import.meta.dirname, "..", ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
