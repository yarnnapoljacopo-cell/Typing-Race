import { Router } from "express";

const router = Router();

async function queryClerkFapi(cookieHeader: string, proxyUrl: string, fapiBase = "https://frontend-api.clerk.dev") {
  const res = await fetch(
    `${fapiBase}/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=6.7.5`,
    {
      headers: {
        Cookie: cookieHeader,
        "Clerk-Proxy-Url": proxyUrl,
        "Clerk-Secret-Key": process.env.CLERK_SECRET_KEY ?? "",
        Accept: "application/json",
        "User-Agent": "WritingSprint-Debug/1.0",
      },
    }
  );
  const body = await res.json() as Record<string, unknown>;
  const client = (body?.response ?? body) as Record<string, unknown> | null;
  return {
    httpStatus: res.status,
    lastActiveSessionId: client?.last_active_session_id ?? null,
    sessionCount: Array.isArray(client?.sessions) ? (client.sessions as unknown[]).length : null,
    sessions: Array.isArray(client?.sessions)
      ? (client.sessions as Record<string, unknown>[]).map((s) => ({
          id: s.id,
          status: s.status,
          userId: s.user_id,
        }))
      : [],
  };
}

/**
 * Temporary diagnostic route. Tests each __client cookie against Clerk FAPI
 * individually so we can identify which one (if any) has an active session.
 * Remove once auth is fixed.
 */
router.get("/debug-clerk-client", async (req, res) => {
  const cookieHeader = req.headers.cookie || "";
  const xff = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(xff) ? xff[0] : xff) || "https";
  const host = req.headers.host || "app.writingsprint.site";
  const proxyUrl = `${protocol}://${host}/api/__clerk`;

  // Decode the FAPI URL from the publishable key so we can verify the proxy target
  const pubKey = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
  let fapiUrlFromKey = "(could not decode)";
  try {
    const b64 = pubKey.replace(/^pk_(live|test)_/, "");
    fapiUrlFromKey = `https://${Buffer.from(b64, "base64").toString().replace(/\$$/, "")}`;
  } catch { /* ignore */ }

  const cookieParts = cookieHeader.split(";").map((c) => c.trim()).filter(Boolean);
  const cookieNames = cookieParts.map((c) => c.split("=")[0].trim());
  const clientCookies = cookieParts.filter((c) => c.split("=")[0].trim() === "__client");
  const otherCookies = cookieParts
    .filter((c) => c.split("=")[0].trim() !== "__client")
    .join("; ");

  const proxyTarget = "https://frontend-api.clerk.dev";

  try {
    const perCookieResults = await Promise.all(
      clientCookies.map(async (cc, idx) => {
        const singleCookieStr = otherCookies ? `${otherCookies}; ${cc}` : cc;
        // Try both the hardcoded proxy target AND the key's FAPI URL
        const [resultDefault, resultFromKey] = await Promise.all([
          queryClerkFapi(singleCookieStr, proxyUrl, proxyTarget).catch((e) => ({ error: String(e) })),
          fapiUrlFromKey !== proxyTarget && fapiUrlFromKey !== "(could not decode)"
            ? queryClerkFapi(singleCookieStr, proxyUrl, fapiUrlFromKey).catch((e) => ({ error: String(e) }))
            : null,
        ]);
        return {
          index: idx,
          jwtPrefix: cc.split("=").slice(1).join("=").substring(0, 50),
          viaHardcodedFapi: resultDefault,
          viaKeyFapi: resultFromKey,
        };
      })
    );

    res.json({
      proxyUrl,
      proxyTarget,
      fapiUrlFromKey,
      keysMatch: fapiUrlFromKey === proxyTarget,
      cookieNames,
      clientCookieCount: clientCookies.length,
      perCookieResults,
    });
  } catch (err) {
    res.status(500).json({ error: String(err), proxyUrl, proxyTarget, fapiUrlFromKey, cookieNames });
  }
});

export default router;
