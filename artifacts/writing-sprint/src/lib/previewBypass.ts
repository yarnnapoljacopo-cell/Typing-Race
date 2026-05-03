/**
 * Dev-only "preview signed-in pages without logging in" bypass.
 *
 * Activate by visiting any URL with `?preview=1` once. The flag is
 * persisted in localStorage so subsequent navigations stay bypassed.
 * Visit any URL with `?preview=0` to turn it back off.
 *
 * The bypass only takes effect when the app is built in dev mode
 * (`import.meta.env.DEV`) so it can never accidentally ship to prod.
 *
 * What it does: route guards in App.tsx treat `previewBypass === true`
 * the same as `isSignedIn`, so protected pages render. Data fetches
 * still need a real Clerk token, so most pages will show empty states
 * — but layouts, styling, and unauthenticated UI are visible.
 */

const STORAGE_KEY = "ws.devPreviewBypass";

function readUrlFlag(): boolean | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const v = params.get("preview");
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return null;
}

function readStorageFlag(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Reads the current bypass state. Synchronous, safe to call in render.
 * Honors a `?preview=1|0` URL param (which also persists to storage).
 */
export function isPreviewBypassActive(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;

  const fromUrl = readUrlFlag();
  if (fromUrl !== null) {
    writeStorageFlag(fromUrl);
    return fromUrl;
  }
  return readStorageFlag();
}
