import { Router } from "express";

const router = Router();

const CLERK_BAPI = "https://api.clerk.com/v1";

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

/** Decode which Clerk instance the secret key belongs to (via BAPI /whoami if available,
 *  or by inspecting the key prefix). sk_live_ = production, sk_test_ = development. */
async function identifySecretKeyInstance(sk: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${CLERK_BAPI}/clients`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sk}`,
        Accept: "application/json",
      },
    });
    return { httpStatus: res.status, ok: res.ok };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * Queries the Clerk Backend (Management) API for users and recent sessions.
 * This tells us whether sign-ins are landing on the writingsprint.site instance
 * or the old typingrace.autos instance.
 */
router.get("/debug-clerk-instance", async (_req, res) => {
  const sk = process.env.CLERK_SECRET_KEY ?? "";
  if (!sk) {
    res.status(500).json({ error: "CLERK_SECRET_KEY not set on server" });
    return;
  }

  // Derive which instance this secret key is for from the key itself.
  // sk_live_... = production, sk_test_... = development.
  // The instance domain is embedded in the key after base64 decoding the suffix.
  let instanceDomain = "(unknown)";
  try {
    const b64 = sk.replace(/^sk_(live|test)_/, "");
    const decoded = Buffer.from(b64, "base64").toString().replace(/\$$/, "").trim();
    if (decoded && decoded.includes(".")) instanceDomain = decoded;
  } catch { /* ignore */ }

  // Also derive from the publishable key for cross-check.
  const pk = process.env.VITE_CLERK_PK ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
  let pkDomain = "(unknown)";
  try {
    const b64 = pk.replace(/^pk_(live|test)_/, "");
    pkDomain = Buffer.from(b64, "base64").toString().replace(/\$$/, "").trim();
  } catch { /* ignore */ }

  try {
    // Fetch the 10 most recently created users
    const usersRes = await fetch(`${CLERK_BAPI}/users?limit=10&order_by=-created_at`, {
      headers: {
        Authorization: `Bearer ${sk}`,
        Accept: "application/json",
      },
    });
    const usersBody = await usersRes.json() as unknown;

    // Fetch recent sessions (last 10)
    const sessionsRes = await fetch(`${CLERK_BAPI}/sessions?limit=10&status=active`, {
      headers: {
        Authorization: `Bearer ${sk}`,
        Accept: "application/json",
      },
    });
    const sessionsBody = await sessionsRes.json() as unknown;

    // Count total users
    const totalUsersRes = await fetch(`${CLERK_BAPI}/users/count`, {
      headers: {
        Authorization: `Bearer ${sk}`,
        Accept: "application/json",
      },
    });
    const totalUsersBody = await totalUsersRes.json() as Record<string, unknown>;

    const users = Array.isArray(usersBody)
      ? (usersBody as Record<string, unknown>[]).map((u) => ({
          id: u.id,
          email: (u.email_addresses as Record<string, unknown>[])?.[0]?.email_address ?? null,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at,
        }))
      : usersBody;

    const sessions = Array.isArray(sessionsBody)
      ? (sessionsBody as Record<string, unknown>[]).map((s) => ({
          id: s.id,
          userId: s.user_id,
          status: s.status,
          lastActivity: s.last_active_at,
        }))
      : sessionsBody;

    res.json({
      secretKeyPrefix: sk.substring(0, 12) + "...",
      secretKeyEnv: instanceDomain,
      publishableKeyEnv: pkDomain,
      instanceMatch: instanceDomain === pkDomain,
      totalUsers: totalUsersBody,
      recentUsers: users,
      activeSessions: sessions,
      usersHttpStatus: usersRes.status,
      sessionsHttpStatus: sessionsRes.status,
    });
  } catch (err) {
    res.status(500).json({ error: String(err), instanceDomain, pkDomain });
  }
});

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

  // Derive the FAPI URL: explicit env var takes priority, then decode from publishable key.
  const pubKey = process.env.VITE_CLERK_PK ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
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

  // Use the explicit CLERK_FAPI_URL env var if set, otherwise fall back to key-derived URL.
  const proxyTarget = process.env.CLERK_FAPI_URL?.trim() ||
    (fapiUrlFromKey !== "(could not decode)" ? fapiUrlFromKey : "https://frontend-api.clerk.dev");

  try {
    const perCookieResults = await Promise.all(
      clientCookies.map(async (cc, idx) => {
        const singleCookieStr = otherCookies ? `${otherCookies}; ${cc}` : cc;
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
