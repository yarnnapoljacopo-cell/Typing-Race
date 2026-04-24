import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/wsHandler";
import { restoreRoomsFromDB } from "./lib/roomManager";

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
setupWebSocketServer(server);

// Start listening immediately so Railway's healthcheck passes right away.
// Room restore runs in the background — a slow DB cold-start won't delay
// the server becoming ready.
server.listen(port, () => {
  logger.info({ port }, "Server listening");

  restoreRoomsFromDB()
    .then(() => {
      logger.info("Rooms restored from DB");
    })
    .catch((err) => {
      logger.error({ err }, "Room restore failed — continuing without restored rooms");
    });
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
