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

const server = createServer(app);
setupWebSocketServer(server);

// Restore any rooms that were active before the last server restart
restoreRoomsFromDB()
  .then(() => {
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Room restore failed — starting anyway");
    server.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  });

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
