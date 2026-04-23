import { Router } from "express";

const router = Router();

/**
 * Temporary diagnostic route — calls Clerk FAPI directly with the browser's
 * cookies and returns the raw client response so we can see exactly what
 * Clerk thinks about the current session without going through the JS SDK.
 * Remove this route once the auth issue is resolved.
 */
router.get("/debug-clerk-client", async (req, res) => {
  const cookieHeader = req.headers.cookie || "";
  const xff = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(xff) ? xff[0] : xff) || "https";
  const host = req.headers.host || "app.writingsprint.site";
  const proxyUrl = `${protocol}://${host}/api/__clerk`;

  const cookieParts = cookieHeader.split(";").map((c) => c.trim()).filter(Boolean);
  const cookieNames = cookieParts.map((c) => c.split("=")[0].trim());
  const clientCookies = cookieParts.filter((c) => c.split("=")[0].trim() === "__client");

  try {
    const fapiRes = await fetch(
      "https://frontend-api.clerk.dev/v1/client?__clerk_api_version=2025-11-10&_clerk_js_version=6.7.5",
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

    const body = await fapiRes.json() as Record<string, unknown>;
    const clientObj = (body?.response ?? body) as Record<string, unknown> | null;

    res.json({
      httpStatus: fapiRes.status,
      proxyUrl,
      cookieNames,
      clientCookieCount: clientCookies.length,
      lastActiveSessionId: clientObj?.last_active_session_id ?? null,
      sessionCount: Array.isArray(clientObj?.sessions) ? (clientObj.sessions as unknown[]).length : null,
      sessions: Array.isArray(clientObj?.sessions)
        ? (clientObj.sessions as Record<string, unknown>[]).map((s) => ({
            id: s.id,
            status: s.status,
            userId: s.user_id,
          }))
        : null,
      rawResponse: body,
    });
  } catch (err) {
    res.status(500).json({ error: String(err), proxyUrl, cookieNames, clientCookieCount: clientCookies.length });
  }
});

export default router;
