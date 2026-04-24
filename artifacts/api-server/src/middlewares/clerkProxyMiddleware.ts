/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import { logger as _logger } from "../lib/logger";

const log = _logger.child({ module: "clerk-proxy" });

/**
 * Derive the correct FAPI base URL from the publishable key.
 * Clerk publishable keys are "pk_live_<base64(fapiHost + '$')>" or "pk_test_...".
 * If we can't decode it we fall back to the generic frontend-api.clerk.dev.
 */
function fapiFromPublishableKey(pk: string): string {
  try {
    const b64 = pk.replace(/^pk_(live|test)_/, "");
    const host = Buffer.from(b64, "base64").toString().replace(/\$$/, "").trim();
    if (host && host.includes(".")) return `https://${host}`;
  } catch { /* ignore */ }
  return "https://frontend-api.clerk.dev";
}

// CLERK_FAPI_URL is an explicit env var set to the correct Clerk FAPI base URL.
// Falls back to deriving the URL from the publishable key, then to the generic FAPI.
const CLERK_FAPI =
  process.env.CLERK_FAPI_URL?.trim() ||
  fapiFromPublishableKey(
    process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? ""
  );

export const CLERK_PROXY_PATH = "/api/__clerk";

// Strip any Domain= attribute so the cookie becomes host-only for app.writingsprint.site.
// Host-only cookies from the same host always overwrite each other (same name + path).
function stripDomain(cookie: string): string {
  return cookie.replace(/;\s*Domain=[^;,]*/gi, "");
}

export function clerkProxyMiddleware(): RequestHandler {
  if (process.env.NODE_ENV !== "production") {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  log.info({ target: CLERK_FAPI }, "clerk-proxy target");

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    // Fail fast if the upstream FAPI host is unreachable (e.g. DNS missing for
    // a custom Clerk domain). Without this the proxy hangs indefinitely, leaving
    // ClerkProvider in a permanent loading state → blank page.
    proxyTimeout: 8000,
    timeout: 8000,
    // We do all cookie domain manipulation manually in proxyRes so we have
    // full control (cookieDomainRewrite would also strip domains from our
    // explicit clearing cookies, defeating the purpose).
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      error: (err, req, res) => {
        log.error({ err: (err as NodeJS.ErrnoException).message, code: (err as NodeJS.ErrnoException).code, url: req.url, fapi: CLERK_FAPI },
          "clerk-proxy: upstream FAPI unreachable — check clerk.writingsprint.site DNS (needs CNAME → frontend-api.clerk.dev)"
        );
        if (!("headersSent" in res && res.headersSent)) {
          (res as import("http").ServerResponse).writeHead(502, { "Content-Type": "application/json" });
          (res as import("http").ServerResponse).end(JSON.stringify({ error: "Clerk FAPI unreachable", hint: "Add CNAME clerk.writingsprint.site → frontend-api.clerk.dev" }));
        }
      },
      proxyReq: (proxyReq, req) => {
        const protocol =
          (Array.isArray(req.headers["x-forwarded-proto"])
            ? req.headers["x-forwarded-proto"][0]
            : req.headers["x-forwarded-proto"]) || "https";
        const host = req.headers.host || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const xff = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }

        // Deduplicate __client cookies — when the browser has both a stale
        // host-only __client and a newer domain-scoped one it sends both,
        // and Clerk FAPI uses whichever comes first (usually the stale one),
        // leaving isSignedIn = false. Keep only the JWT with the highest iat.
        const rawCookie = req.headers["cookie"] || "";
        const allCookies = rawCookie.split(";").map((c) => c.trim()).filter(Boolean);
        const clientCookies = allCookies.filter(
          (c) => c.split("=")[0].trim() === "__client"
        );

        if (clientCookies.length > 1) {
          // RFC 6265 §5.4: cookies with equal paths are ordered by creation time,
          // oldest first. The newest __client (set by the oauth_callback) is therefore
          // the LAST entry. Pick it so Clerk FAPI sees the authenticated client.
          const chosenCookie = clientCookies[clientCookies.length - 1];
          const deduped = allCookies
            .filter((c) => c.split("=")[0].trim() !== "__client")
            .concat([chosenCookie]);
          proxyReq.setHeader("Cookie", deduped.join("; "));
          log.info(
            { count: clientCookies.length },
            "clerk-proxy deduped __client cookies (kept last)"
          );
        }

        // Log the __client cookie being sent for /v1/client calls so we can
        // verify which client the browser is presenting after the oauth redirect.
        if (req.url?.includes("/v1/client") && !req.url?.includes("/sessions")) {
          const cookieHeader = (proxyReq.getHeader("Cookie") as string) || rawCookie;
          const clientJwt = cookieHeader
            .split(";")
            .map((c) => c.trim())
            .find((c) => c.split("=")[0].trim() === "__client")
            ?.split("=")
            .slice(1)
            .join("=");
          let clientId = "MISSING";
          if (clientJwt) {
            try {
              const payload = JSON.parse(
                Buffer.from(clientJwt.split(".")[1], "base64url").toString()
              );
              clientId = payload.id || "NO_ID";
            } catch {
              clientId = "PARSE_ERROR";
            }
          }
          log.info(
            { url: req.url, clientId },
            "clerk-proxy GET /v1/client cookie"
          );
        }
      },

      proxyRes: (proxyRes, req, _res) => {
        const isOAuthCallback = req.url?.includes("/oauth_callback");
        const location = proxyRes.headers["location"];

        // ── Step 1: Rewrite all Set-Cookie Domain attributes ──────────────
        // Strip Domain so cookies become host-only for app.writingsprint.site.
        // This ensures new cookies always overwrite old host-only cookies with
        // the same name+path (browsers treat same-name host-only cookies as
        // a single slot).
        const rawCookies = proxyRes.headers["set-cookie"];
        if (rawCookies) {
          const list = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
          proxyRes.headers["set-cookie"] = list.map(stripDomain);
        }

        // ── Step 2: Log redirects ──────────────────────────────────────────
        if (location && proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400) {
          const setCookieRaw = proxyRes.headers["set-cookie"];
          const cookieNames = Array.isArray(setCookieRaw)
            ? setCookieRaw.map((c) => c.split("=")[0])
            : setCookieRaw ? [setCookieRaw.split("=")[0]] : [];
          log.info(
            { method: req.method, url: req.url, status: proxyRes.statusCode, location, cookieNames },
            "clerk-proxy redirect"
          );

          // Rewrite Location if it points to the raw FAPI domain (either the generic
          // frontend-api.clerk.dev or the custom FAPI host like clerk.writingsprint.site).
          const fapiHost = (() => {
            try { return new URL(CLERK_FAPI).host; } catch { return "frontend-api.clerk.dev"; }
          })();
          if (typeof location === "string" &&
            (location.includes("frontend-api.clerk.dev") || location.includes(fapiHost))) {
            const rewritten = location
              .replace(/https:\/\/frontend-api\.clerk\.dev/, `https://${req.headers.host}${CLERK_PROXY_PATH}`)
              .replace(new RegExp(`https://${fapiHost.replace(".", "\\.")}`, "g"), `https://${req.headers.host}${CLERK_PROXY_PATH}`);
            log.info({ original: location, rewritten }, "clerk-proxy location rewritten");
            proxyRes.headers["location"] = rewritten;
          }
        }

        // ── Step 3: oauth_callback special handling ────────────────────────
        if (isOAuthCallback) {
          const setCookieRaw = proxyRes.headers["set-cookie"];
          const cookieNames = Array.isArray(setCookieRaw)
            ? setCookieRaw.map((c) => c.split("=")[0])
            : setCookieRaw ? [setCookieRaw.split("=")[0]] : [];
          log.info(
            { status: proxyRes.statusCode, location, cookieNames },
            "clerk-proxy oauth_callback response"
          );

          if (proxyRes.statusCode === 303) {
            // Redirect to /portal instead of / so the user lands on a page that
            // Clerk JS re-initialises on. GET /v1/client picks up the fresh
            // __client cookie and __client_uat and sets isSignedIn = true.
            if (typeof location === "string") {
              try {
                const url = new URL(location);
                const isOurDomain =
                  url.hostname === "app.writingsprint.site" ||
                  url.hostname === "writingsprint.site";
                if (isOurDomain && url.pathname === "/") {
                  const newLocation = `${url.origin}/portal`;
                  proxyRes.headers["location"] = newLocation;
                  log.info(
                    { original: location, newLocation },
                    "clerk-proxy oauth_callback location rewritten to /portal"
                  );
                }
              } catch {
                // not a valid URL — leave as-is
              }
            }
          }
        }
      },
    },
  }) as RequestHandler;
}
