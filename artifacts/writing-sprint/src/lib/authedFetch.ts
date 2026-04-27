import { useAuth } from "@clerk/react";
import { useCallback } from "react";

type AuthedFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Returns a fetch wrapper that:
 * 1. Calls Clerk's getToken() before every request and attaches it as
 *    "Authorization: Bearer <token>" — immune to cookie timing races.
 * 2. On 401, force-refreshes the token (skipCache) and retries exactly once
 *    before giving up — handles mid-rotation token state automatically.
 * 3. Always includes credentials:include as a cookie fallback.
 *
 * This is the correct pattern for web apps using Clerk behind an API proxy
 * (e.g. Railway + clerk.writingsprint.site) where cookie delivery latency
 * is high enough to cause intermittent 401s on first load or token rotation.
 */
export function useAuthedFetch(): AuthedFetch {
  const { getToken } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const makeRequest = async (skipCache = false): Promise<Response> => {
        const token = await getToken({ skipCache });
        const headers = new Headers(options.headers as HeadersInit | undefined);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, credentials: "include", headers });
      };

      const res = await makeRequest();
      if (res.status === 401) {
        return makeRequest(true);
      }
      return res;
    },
    [getToken],
  );
}
