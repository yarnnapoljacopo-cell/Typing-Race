import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

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

// ── Health check — registered FIRST, before Clerk middleware ─────────────────
// This guarantees Railway's healthcheck at /api/healthz always gets an
// instant 200 regardless of Clerk initialisation state or upstream timeouts.
app.get("/api/healthz", (_req, res) => { res.json({ status: "ok" }); });
app.get("/api/health",  (_req, res) => { res.json({ status: "ok" }); });

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Provide the RSA public key directly for JWT verification.
// This bypasses the CLERK_SECRET_KEY entirely for token validation, so
// mismatched secrets from old Clerk instances can't interfere.
// Key is fetched from https://clerk.writingsprint.site/.well-known/jwks.json
// (kid: ins_3CkebRzuovnqLClfMK7X03qRfIk)
const CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1rmkjnmJSzTNYozqYtT9
ZgGTGhf51VBPrF6bnU8Wy1ztTd0mb3bxXAzt8GVCqur6yOG2z14p1/+QDY8XKEbL
+AtKU8+OXmxVWgprC3N3rE/H0kTx47F5LWcnI4MNT2sttbrPIXVXmHfC7lYIb2KX
oUd8UkacviE8pim8a9rnq34IrNMNrYlAuPzAdGw+aN9UZCGeEv5qADJ8UMAQQ7yb
RTgpYun6deQRGbOE+FZ8ZYGbkfQIs18y4dYRTCQoxXQ0Hi7jCNay7KmNHQALceGe
zrGYM66rkGVomzpnw9YU+q4si/BRbqPbSjZmgmq4VOaYpKwJOPrYtW++oM/6I+YP
bQIDAQAB
-----END PUBLIC KEY-----`;

const resolvedPublishableKey =
  process.env.VITE_CLERK_PK ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY ??
  process.env.CLERK_PUBLISHABLE_KEY;

app.use(clerkMiddleware({ publishableKey: resolvedPublishableKey, jwtKey: CLERK_JWT_KEY }));

app.use("/api", router);

// ── Production: serve the built React frontend ────────────────────────────
// Vite builds the writing-sprint app to artifacts/writing-sprint/dist/public/
// relative to the project root (process.cwd()).  Using process.cwd() here is
// more reliable than __dirname because Railway always starts the process from
// the repo root, and it makes the resolved path clearly visible in startup logs.
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(process.cwd(), "artifacts/writing-sprint/dist/public");
  logger.info({ frontendDist }, "Production: serving frontend static files from");
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for any non-API, non-WS route
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
