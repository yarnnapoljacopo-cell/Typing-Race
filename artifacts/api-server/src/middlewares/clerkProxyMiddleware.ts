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
    cookieDomainRewrite: { "*": "" },
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

        // Extra logging for oauth_callback so we can see all Set-Cookie headers
        if (isOAuthCallback) {
          const setCookieRaw = proxyRes.headers["set-cookie"];
          log.info(
            { status: proxyRes.statusCode, location, setCookie: setCookieRaw },
            "clerk-proxy oauth_callback response"
          );
        }
      },
    },
  }) as RequestHandler;
}
