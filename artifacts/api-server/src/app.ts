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

// Don't advertise the framework — removes the "X-Powered-By: Express" header
// so we leak slightly less about the stack to opportunistic scanners.
app.disable("x-powered-by");

// ── Security response headers ───────────────────────────────────────────────
// Set manually (rather than pulling in helmet) so there's no extra dependency.
// No CSP here on purpose: the app uses inline styles/keyframes and a strict
// policy would need careful per-page nonce work — these headers are the safe,
// high-value subset that can't break rendering.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");      // no MIME sniffing
  res.setHeader("X-Frame-Options", "SAMEORIGIN");          // anti-clickjacking
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

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

// ── CORS allowlist ──────────────────────────────────────────────────────────
// Previously `origin: true` reflected ANY requesting origin while also allowing
// credentials — meaning any website could make credentialed (cookie-bearing)
// requests against a logged-in user and read the response. Since the SPA is
// served from the SAME origin as this API in production, the web app needs no
// cross-origin allowance at all. We allow:
//   - requests with no Origin header (same-origin fetches, native apps, curl)
//   - an explicit allowlist (prod domains + localhost dev), extendable via the
//     ALLOWED_ORIGINS env var (comma-separated) for the desktop build or staging.
// Unknown origins simply don't get CORS headers, so the browser blocks the
// cross-origin read — same-origin traffic is unaffected.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.writingsprint.site",
  "https://writingsprint.site",
  "http://localhost:3000",
  "http://localhost:5173",
];
const envAllowed = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowed]);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // No Origin header → same-origin / non-browser client → allow.
      if (!origin) { callback(null, true); return; }
      if (ALLOWED_ORIGINS.has(origin)) { callback(null, true); return; }
      // Unknown origin: respond WITHOUT CORS headers (don't throw — throwing
      // turns into a 500; we just decline the cross-origin grant).
      callback(null, false);
    },
  }),
);
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
