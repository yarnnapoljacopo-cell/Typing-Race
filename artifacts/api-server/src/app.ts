import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalLimiter } from "./lib/rateLimits";

const app: Express = express();

// Trust reverse proxy headers (Replit, Railway, Cloudflare, etc.)
// so Express sees the correct client IP and protocol.
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Health checks — registered FIRST, before Clerk middleware & rate limiter
// This guarantees the deep probe measures only app + DB health, never auth
// init slowness or rate-limit pressure, and the lite probe always gets an
// instant 200 for Railway's container readiness check.
app.get("/api/healthz", (_req, res) => { res.json({ status: "ok" }); });
app.get("/api/health",  (_req, res) => { res.json({ status: "ok" }); });
app.get("/api/healthz/deep", async (_req, res) => {
  const { deepHealth } = await import("./lib/healthCheck");
  const result = await deepHealth();
  res.status(result.status === "ok" ? 200 : 503).json(result);
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const resolvedPublishableKey = process.env.VITE_CLERK_PK ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;

app.use(clerkMiddleware({ publishableKey: resolvedPublishableKey }));

app.use("/api", generalLimiter, router);

// ── Production: serve the built React frontend ────────────────────────────
// Vite builds the writing-sprint app to artifacts/writing-sprint/dist/public/
// relative to the project root (process.cwd()).  Using process.cwd() here is
// more reliable than __dirname because Railway always starts the process from
// the repo root, and it makes the resolved path clearly visible in startup logs.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(process.cwd(), "artifacts/writing-sprint/dist/public");
  logger.info({ frontendDist }, "Production: serving frontend static files from");

  // Hashed assets (/assets/*.js, /assets/*.css) are content-addressed so they
  // can be cached by CDNs forever — the hash changes with every build.
  // Everything else (including index.html) must never be CDN-cached because it
  // contains the hash references to the current JS/CSS bundle.
  app.use(
    express.static(frontendDist, {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          // index.html, favicon, logo, etc. — always revalidate, never store
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    }),
  );

  // SPA fallback — serve index.html for any non-API, non-WS route.
  // Always no-store so Cloudflare / Railway CDN never caches the HTML shell.
  app.use((_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
