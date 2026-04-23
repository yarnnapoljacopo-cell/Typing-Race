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

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

const CLERK_SESSION_COOKIES = ["__client", "__session", "__client_uat"];

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

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    // We do all cookie domain manipulation manually in proxyRes so we have
    // full control (cookieDomainRewrite would also strip domains from our
    // explicit clearing cookies, defeating the purpose).
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
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

          // Rewrite Location if it points to the raw FAPI domain
          if (typeof location === "string" && location.includes("frontend-api.clerk.dev")) {
            const rewritten = location.replace(
              /https:\/\/frontend-api\.clerk\.dev/,
              `https://${req.headers.host}${CLERK_PROXY_PATH}`
            );
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
            // Inject expiry Set-Cookie headers to clear any Clerk session cookies
            // stored under older domain scopes. We send clearing cookies for every
            // combination of (domain, SameSite) because Chrome tracks cookies with
            // different SameSite attributes as separate slots — a SameSite=Lax
            // clearing cookie will NOT evict a SameSite=None cookie of the same name.
            const domains = [
              "",                          // host-only (no Domain attr)
              "; Domain=writingsprint.site",
              "; Domain=app.writingsprint.site",
              "; Domain=typingrace.autos",
            ];
            const sameSites = [
              "; SameSite=Lax",
              "; SameSite=None",
              "; SameSite=Strict",
              "",                          // no SameSite attr
            ];

            const clearingCookies: string[] = [];
            for (const name of CLERK_SESSION_COOKIES) {
              for (const domain of domains) {
                for (const ss of sameSites) {
                  clearingCookies.push(
                    `${name}=; Max-Age=0; Path=/${domain}; Secure${ss}`
                  );
                }
              }
            }

            const existing = Array.isArray(proxyRes.headers["set-cookie"])
              ? proxyRes.headers["set-cookie"]
              : proxyRes.headers["set-cookie"]
              ? [proxyRes.headers["set-cookie"]]
              : [];

            // Clearing cookies first, then real cookies (browser processes in order)
            proxyRes.headers["set-cookie"] = [...clearingCookies, ...existing];
            log.info({ count: clearingCookies.length }, "clerk-proxy injected stale-cookie clearing headers");

            // Redirect to /portal instead of / so the user lands on a page that
            // Clerk JS initialises on. GET /v1/client picks up the fresh session
            // from the __client cookie and isSignedIn becomes true immediately.
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
