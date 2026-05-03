import { useAuth } from "@clerk/react";
import { useCallback } from "react";

type AuthedFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * How long we'll wait for Clerk to surface a real session token before
 * giving up and firing the request anyway. Clerk almost always returns
 * a token in well under a second once `useAuth().isLoaded` flips, so
 * this is a small safety net for the page-load race that previously
 * made signed-in pages look "stuck on loading" until a manual refresh.
 */
const TOKEN_WAIT_TIMEOUT_MS = 2500;
const TOKEN_WAIT_INTERVAL_MS = 50;

/**
 * Returns a fetch wrapper that:
 * 1. Waits (briefly) for Clerk to issue a session token, so the very
 *    first request after a hard navigation isn't a guaranteed 401.
 *    If Clerk legitimately has no session, we give up after ~2.5 s and
 *    proceed unauthenticated (the server will respond appropriately).
 * 2. Calls Clerk's getToken() before every request and attaches it as
 *    "Authorization: Bearer <token>" — immune to cookie timing races.
 * 3. On 401, force-refreshes the token (skipCache) and retries exactly
 *    once before giving up — handles mid-rotation token state.
 * 4. Always includes credentials:include as a cookie fallback.
 *
 * This is the correct pattern for web apps using Clerk behind an API
 * proxy (e.g. Railway + clerk.writingsprint.site) where cookie delivery
 * latency is high enough to cause intermittent 401s on first load or
 * token rotation.
 */
export function useAuthedFetch(): AuthedFetch {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      // Resolve the auth token we'll attach. If the user is supposed to
      // be signed in but Clerk hasn't surfaced a token yet, poll a few
      // times before falling back to an unauthenticated attempt. This
      // avoids the race where the first query of a fresh page load
      // fires before Clerk hydrates the session.
      const resolveInitialToken = async (): Promise<string | null> => {
        let token = await getToken();
        if (token) return token;

        // Don't wait if Clerk says there's nothing to wait for.
        if (isLoaded && !isSignedIn) return null;

        const start = Date.now();
        while (Date.now() - start < TOKEN_WAIT_TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, TOKEN_WAIT_INTERVAL_MS));
          token = await getToken();
          if (token) return token;
          // If we now know for sure there's no session, stop waiting.
          if (isLoaded && !isSignedIn) return null;
        }
        return null;
      };

      const sendWithToken = async (token: string | null): Promise<Response> => {
        const headers = new Headers(options.headers as HeadersInit | undefined);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, credentials: "include", headers });
      };

      const initialToken = await resolveInitialToken();
      const res = await sendWithToken(initialToken);
      if (res.status !== 401) return res;

      // Mid-rotation token? Force-refresh once and retry exactly once.
      const refreshed = await getToken({ skipCache: true });
      return sendWithToken(refreshed);
    },
    [getToken, isLoaded, isSignedIn],
  );
}
