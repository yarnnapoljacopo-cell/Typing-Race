const DEMO_KEY = "ws.localDemo.enabled";

/** A local development session. Never grants access on a deployed build. */
function resolveDemoSession(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) return false;
  // The standalone room fixtures own their own transport.
  if (window.location.pathname.includes("/sim/")) return false;
  const flag = new URLSearchParams(window.location.search).get("demo");
  try {
    if (flag === "1") localStorage.setItem(DEMO_KEY, "1");
    if (flag === "0") localStorage.removeItem(DEMO_KEY);
    return flag === "1" || (flag !== "0" && localStorage.getItem(DEMO_KEY) === "1");
  } catch { return flag === "1"; }
}

// Freeze the mode for this document so another tab cannot change auth without
// also installing this document's isolated demo transport.
const enabled = resolveDemoSession();
export function isDemoSession() { return enabled; }

export function exitDemoSession() {
  localStorage.removeItem(DEMO_KEY);
  window.location.assign(`${import.meta.env.BASE_URL}portal?demo=0`);
}
export const DEMO_USER_ID = "local-demo-writer";
export const DEMO_NAME = "Alex";
export const demoStorageKey = (key: string) => isDemoSession() ? `ws.demo.${key}` : key;
