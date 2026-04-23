/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import { logger as _logger } from "../lib/logger";

const log = _logger.child({ module: "clerk-proxy" });

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
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
    // Rewrite Set-Cookie domain from Clerk's domain to the current host so
    // the browser stores session cookies for the app's own domain.
    // Rewrite the Domain on all Clerk-issued cookies to writingsprint.site so
    // the browser stores them for app.writingsprint.site (and the apex domain).
    // The old Clerk instance was configured for typingrace.autos; stripping the
    // domain entirely (empty string) leaves cookies host-only, which breaks
    // cross-path sharing — use the real domain instead.
    cookieDomainRewrite: { "*": "writingsprint.site" },
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        // Prefer x-forwarded-proto so we get "https" even when Replit's
        // mTLS proxy speaks plain HTTP to us internally.
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
      },
      proxyRes: (proxyRes, req, _res) => {
        const isOAuthCallback = req.url?.includes("/oauth_callback");
        const location = proxyRes.headers["location"];

        // Log redirects
        if (location && proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400) {
          const setCookieRaw = proxyRes.headers["set-cookie"];
          const cookieNames = Array.isArray(setCookieRaw)
            ? setCookieRaw.map((c) => c.split("=")[0])
            : setCookieRaw ? [setCookieRaw.split("=")[0]] : [];
          log.info(
            { method: req.method, url: req.url, status: proxyRes.statusCode, location, cookieNames },
            "clerk-proxy redirect"
          );

          // Rewrite Location if it points back to the raw FAPI domain
          if (typeof location === "string" && location.includes("frontend-api.clerk.dev")) {
            const rewritten = location.replace(
              /https:\/\/frontend-api\.clerk\.dev/,
              `https://${req.headers.host}${CLERK_PROXY_PATH}`
            );
            log.info({ original: location, rewritten }, "clerk-proxy location rewritten");
            proxyRes.headers["location"] = rewritten;
          }
        }

        // Extra logging + redirect fix for oauth_callback
        if (isOAuthCallback) {
          const setCookieRaw = proxyRes.headers["set-cookie"];
          const cookieNames = Array.isArray(setCookieRaw)
            ? setCookieRaw.map((c) => c.split("=")[0])
            : setCookieRaw ? [setCookieRaw.split("=")[0]] : [];
          log.info(
            { status: proxyRes.statusCode, location, cookieNames },
            "clerk-proxy oauth_callback response"
          );

          // Clerk's "ret_obj_type=redirect" sends the browser straight to "/" which
          // has no <SignIn> component to complete the session handshake.
          // Rewrite the Location to /sign-in so Clerk's SignIn component can
          // process the session and then redirect to /portal via forceRedirectUrl.
          if (proxyRes.statusCode === 303 && typeof location === "string") {
            try {
              const url = new URL(location);
              const isOurDomain =
                url.hostname === "app.writingsprint.site" ||
                url.hostname === "writingsprint.site";
              if (isOurDomain && url.pathname === "/") {
                const newLocation = `${url.origin}/sign-in`;
                proxyRes.headers["location"] = newLocation;
                log.info(
                  { original: location, newLocation },
                  "clerk-proxy oauth_callback location rewritten to /sign-in"
                );
              }
            } catch {
              // not a valid URL — leave as-is
            }
          }
        }
      },
    },
  }) as RequestHandler;
}
