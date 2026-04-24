import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/wsHandler";
import { restoreRoomsFromDB } from "./lib/roomManager";
import { ensureSchema } from "./lib/ensureSchema";
import { seedItems } from "./lib/seedItems";
import { seedCraftingRecipes } from "./lib/seedCraftingRecipes";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function decodeFapiFromKey(pk: string): string {
  try {
    const b64 = pk.replace(/^pk_(live|test)_/, "");
    const host = Buffer.from(b64, "base64").toString().replace(/\$$/, "").trim();
    if (host && host.includes(".")) return `https://${host}`;
  } catch { /* ignore */ }
  return "https://frontend-api.clerk.dev";
}
const _pubKey = process.env.VITE_CLERK_PK ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
const _resolvedFapi = process.env.CLERK_FAPI_URL?.trim() || decodeFapiFromKey(_pubKey);
const _resolvedPkSource = process.env.VITE_CLERK_PK ? "VITE_CLERK_PK" : process.env.VITE_CLERK_PUBLISHABLE_KEY ? "VITE_CLERK_PUBLISHABLE_KEY" : process.env.CLERK_PUBLISHABLE_KEY ? "CLERK_PUBLISHABLE_KEY" : "(none)";
console.log("[startup-debug] NODE_ENV:", process.env.NODE_ENV, "| CLERK_SECRET_KEY set:", !!process.env.CLERK_SECRET_KEY, "| resolved PK source:", _resolvedPkSource, "| PK prefix:", _pubKey.slice(0, 30), "| resolved FAPI:", _resolvedFapi);

const server = createServer(app);
const wss = setupWebSocketServer(server);

// Start listening immediately so Railway's healthcheck passes right away.
// Room restore runs in the background — a slow DB cold-start won't delay
// the server becoming ready.
server.listen(port, () => {
  logger.info({ port }, "Server listening");

  // Ensure all DB tables exist (safe to run every time; idempotent).
  // DATABASE_URL is only available at runtime on Railway, not during the
  // build phase, so drizzle-kit push in the build command is a no-op there.
  ensureSchema()
    .then(() => seedItems())
    .then(() => seedCraftingRecipes())
    .then(() => restoreRoomsFromDB())
    .then(() => {
      logger.info("Rooms restored from DB");
    })
    .catch((err) => {
      logger.error({ err }, "Schema/room restore failed — continuing without restored rooms");
    });
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});

// When Railway deploys a new container it sends SIGTERM to the old one.
// Close all open WebSocket connections with code 1012 (Service Restart) so
// every client immediately reconnects to the new container. Without this,
// clients that were connected to the old container end up in a split-brain
// state where they can no longer see participants connected to the new one.
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received signal — closing WebSocket connections for graceful handoff");
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.close(1012, "Server restarting — please reconnect");
    }
  });
  // Give clients 2 s to handle the close, then exit so Railway can replace us.
  setTimeout(() => process.exit(0), 2_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
