import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useToast } from "@/hooks/use-toast";
import {
  SKINS_MOCK_CSS,
  SKINS_MOCK_BODY,
  KART_KEYS,
  TRACK_KEYS,
} from "@/lib/skinsMockHtml";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SkinDef {
  key: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "ultra";
  unlocked: boolean;
}
interface SkinsData {
  cars: SkinDef[];
  roads: SkinDef[];
  equippedCarSkin: string;
  equippedRoadSkin: string;
}
interface CoinData { balance: number }

type AF = (url: string, opts?: RequestInit) => Promise<Response>;

async function fetchSkins(af: AF): Promise<SkinsData> {
  const res = await af(`${basePath}/api/skins`);
  if (!res.ok) throw new Error("Failed to load skins");
  return res.json();
}
async function fetchCoins(af: AF): Promise<CoinData> {
  const res = await af(`${basePath}/api/coins`);
  if (!res.ok) throw new Error("Failed to load coins");
  return res.json();
}
async function equipSkin(af: AF, type: "car" | "road", key: string): Promise<void> {
  const res = await af(`${basePath}/api/skins/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, key }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to equip");
  }
}

// Properly scope ALL mock CSS rules under `.skins-mock-root` so generic mock
// class names (`.page`, `.topnav`, `.section-title`, `.skin-card`, ...) cannot
// bleed into the rest of the app while this page is mounted.
function scopeMockCss(css: string): string {
  const SCOPE = ".skins-mock-root";
  // 1. Drop the `*` reset — Tailwind preflight already handles box-sizing.
  let out = css.replace(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*\}/, "");
  // 2. Walk the stylesheet, prefixing every selector list with `.skins-mock-root `.
  //    Preserve at-rules: keep `:root`, `@keyframes`, `@font-face`, `@media`
  //    intact (with @media handled recursively below).
  let result = "";
  let i = 0;
  while (i < out.length) {
    // skip whitespace
    while (i < out.length && /\s/.test(out[i])) { result += out[i]; i++; }
    if (i >= out.length) break;
    // @-rules
    if (out[i] === "@") {
      const atEnd = out.indexOf("{", i);
      const atRule = out.slice(i, atEnd).trim();
      // find matching closing brace at depth 0
      let depth = 0; let j = atEnd;
      for (; j < out.length; j++) {
        if (out[j] === "{") depth++;
        else if (out[j] === "}") { depth--; if (depth === 0) { j++; break; } }
      }
      const block = out.slice(atEnd + 1, j - 1);
      if (atRule.startsWith("@media")) {
        result += atRule + " {" + scopeMockCss(block) + "}";
      } else {
        // @keyframes / @font-face / @supports — pass through verbatim
        result += out.slice(i, j);
      }
      i = j;
      continue;
    }
    // Regular rule: capture selector list up to "{"
    const braceAt = out.indexOf("{", i);
    if (braceAt < 0) break;
    const selectors = out.slice(i, braceAt);
    // find matching close
    let depth = 0; let j = braceAt;
    for (; j < out.length; j++) {
      if (out[j] === "{") depth++;
      else if (out[j] === "}") { depth--; if (depth === 0) { j++; break; } }
    }
    const body = out.slice(braceAt, j); // includes the braces
    // Scope each selector in the comma-separated list
    const scoped = selectors
      .split(",")
      .map((sel) => {
        const s = sel.trim();
        if (!s) return s;
        if (s === ":root") return s; // keep CSS variables global (only --cream/--blue/etc)
        if (s.startsWith(SCOPE)) return s;
        // body { ... } -> .skins-mock-root { ... }
        if (s === "body" || s.startsWith("body ")) {
          return SCOPE + s.slice(4);
        }
        return SCOPE + " " + s;
      })
      .join(", ");
    result += scoped + body;
    i = j;
  }
  return result;
}

const SCOPED_CSS = scopeMockCss(SKINS_MOCK_CSS);

const FONT_LINK_ID = "skins-mock-fonts";

export default function Skins() {
  const [, setLocation] = useLocation();
  const authedFetch = useAuthedFetch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<SkinsData>({
    queryKey: ["skins"],
    queryFn: () => fetchSkins(authedFetch),
  });
  const { data: coinData } = useQuery<CoinData>({
    queryKey: ["coinBalance"],
    queryFn: () => fetchCoins(authedFetch),
    staleTime: 30_000,
  });

  const equipMutation = useMutation({
    mutationFn: ({ type, key }: { type: "car" | "road"; key: string }) =>
      equipSkin(authedFetch, type, key),
    onSuccess: (_d, vars) => {
      qc.setQueryData<SkinsData | undefined>(["skins"], (old) =>
        old
          ? {
              ...old,
              equippedCarSkin: vars.type === "car" ? vars.key : old.equippedCarSkin,
              equippedRoadSkin: vars.type === "road" ? vars.key : old.equippedRoadSkin,
            }
          : old,
      );
      toast({ title: "Skin equipped", description: "It will appear in your next sprint." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not equip", description: err.message, variant: "destructive" });
    },
  });

  // Inject Google Fonts once for the page
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Sync DOM state (selected card, equipped tag, click handlers) with API data
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !data) return;

    const carUnlocked: Record<string, boolean> = {};
    const carRarity: Record<string, string> = {};
    const carName: Record<string, string> = {};
    data.cars.forEach((c) => {
      carUnlocked[c.key] = c.unlocked;
      carRarity[c.key] = c.rarity;
      carName[c.key] = c.name;
    });
    const roadUnlocked: Record<string, boolean> = {};
    data.roads.forEach((r) => { roadUnlocked[r.key] = r.unlocked; });

    const allCards = root.querySelectorAll<HTMLElement>("[data-skin-key]");
    const cleanups: Array<() => void> = [];

    allCards.forEach((card) => {
      const key = card.dataset.skinKey!;
      const isKart = KART_KEYS.includes(key as never);
      const unlocked = isKart ? carUnlocked[key] : roadUnlocked[key];
      const isEquipped =
        (isKart && data.equippedCarSkin === key) ||
        (!isKart && data.equippedRoadSkin === key);

      // Reset card classes
      card.classList.toggle("locked", !unlocked);
      card.classList.toggle("selected", isEquipped);

      // Update / inject the meta tag (Equipped / Owned / Locked)
      const meta = card.querySelector<HTMLElement>(".skin-meta");
      if (meta) {
        let tag = meta.querySelector<HTMLElement>(".skin-tag");
        if (!tag) {
          tag = document.createElement("span");
          tag.className = "skin-tag";
          meta.appendChild(tag);
        }
        tag.classList.remove("tag-equipped", "tag-owned", "tag-locked", "tag-ultra");
        if (isEquipped) {
          tag.classList.add("tag-equipped");
          tag.textContent = "Equipped";
        } else if (unlocked) {
          tag.classList.add("tag-owned");
          tag.textContent = "Owned";
        } else {
          tag.classList.add("tag-locked");
          tag.textContent = "Locked";
        }
      }

      // Show / hide lock overlay based on unlock state
      const lockOverlay = card.querySelector<HTMLElement>(".lock-overlay");
      if (lockOverlay) {
        lockOverlay.style.display = unlocked ? "none" : "";
      }

      // Wire click handler for unlocked, non-equipped cards
      if (unlocked && !isEquipped) {
        card.style.cursor = "pointer";
        const handler = () => {
          if (equipMutation.isPending) return;
          equipMutation.mutate({ type: isKart ? "car" : "road", key });
        };
        card.addEventListener("click", handler);
        cleanups.push(() => card.removeEventListener("click", handler));
      } else {
        card.style.cursor = unlocked ? "default" : "default";
      }

      // For locked cards, wire the in-card "Unlock in Shop" button
      if (!unlocked) {
        const btn = card.querySelector<HTMLButtonElement>(".lock-btn");
        if (btn) {
          const goShop = (e: MouseEvent) => {
            e.stopPropagation();
            setLocation("/shop");
          };
          btn.addEventListener("click", goShop);
          cleanups.push(() => btn.removeEventListener("click", goShop));
        }
      }
    });

    // Update section counts in the eyebrows
    const counts = root.querySelectorAll<HTMLElement>(".section-count");
    if (counts.length >= 1) {
      const ownedCars = data.cars.filter((c) => c.unlocked).length;
      counts[0].innerHTML = `<strong>${ownedCars}</strong> / ${data.cars.length} owned`;
    }
    if (counts.length >= 2) {
      const ownedRoads = data.roads.filter((r) => r.unlocked).length;
      counts[1].innerHTML = `<strong>${ownedRoads}</strong> / ${data.roads.length} owned`;
    }

    // Update the active-preview banner
    const previewName = root.querySelector<HTMLElement>("#previewName");
    const equippedDef = data.cars.find((c) => c.key === data.equippedCarSkin);
    if (previewName && equippedDef) previewName.textContent = equippedDef.name;
    void carRarity; void carName;

    return () => { cleanups.forEach((fn) => fn()); };
    // Intentionally narrow deps: re-wire only when API state changes, not on every
    // mutation object identity churn. `equipMutation` is captured via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, setLocation]);

  return (
    <div ref={rootRef} className="skins-mock-root">
      {/* Scoped mock styles + rarity-mythic alias for cards labelled mythic */}
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS + `
        .skins-mock-root .topnav { padding: 0 20px; }
        .skins-mock-root .preview-banner { display: flex; align-items: center; gap: 18px;
          background: white; border: 1px solid var(--border); border-radius: 22px;
          padding: 18px 22px; margin-bottom: 36px;
          box-shadow: 0 4px 20px rgba(107,143,212,0.10); position: relative; overflow: hidden; }
        .skins-mock-root .preview-banner::before { content:''; position:absolute; inset:0;
          background: radial-gradient(ellipse 60% 80% at 0% 50%, rgba(59,95,219,0.06), transparent 70%);
          pointer-events:none; }
        .skins-mock-root .preview-kart-area { width: 130px; height: 78px; border-radius: 14px;
          background: linear-gradient(160deg, #dbeafe, #eff6ff); display:flex;
          align-items:center; justify-content:center; flex-shrink:0; position: relative; z-index:1; }
        .skins-mock-root .preview-info { flex:1; position:relative; z-index:1; }
        .skins-mock-root .preview-label { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.14em;
          color: var(--gold-dark); text-transform: uppercase; margin-bottom: 4px; }
        .skins-mock-root .preview-name { font-family: "Playfair Display", serif; font-size: 1.5rem;
          font-weight: 900; color: var(--ink); letter-spacing: -0.01em; }
        .skins-mock-root .preview-badges { display:flex; gap:6px; margin-top:6px; }
        .skins-mock-root .preview-badge { font-size: 0.65rem; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
        .skins-mock-root .pbadge-blue { background: rgba(59,95,219,0.10); color: var(--blue); border: 1px solid rgba(59,95,219,0.22); }
        .skins-mock-root .pbadge-green { background: #f0fdf4; color: #15803d; border: 1px solid rgba(34,197,94,0.2); }
        .skins-mock-root .equip-btn { display:flex; align-items:center; gap:6px; padding: 9px 18px;
          background: linear-gradient(135deg, #2dbe6e, #15803d); color: white; border: none;
          border-radius: 999px; font-weight: 700; cursor: default; font-family: "DM Sans", sans-serif;
          box-shadow: 0 4px 12px rgba(21,128,61,0.3); position:relative; z-index:1; }
        .skins-mock-root .rarity-mythic { color: #b45309; }
        .skins-mock-root .rarity-mythic::before { background: #f59e0b; box-shadow: 0 0 4px rgba(245,158,11,0.6); }
      ` }} />

      {/* Page chrome — back nav and balance */}
      <nav className="topnav">
        <button className="nav-back" onClick={() => setLocation("/portal")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="nav-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Skins
        </div>
        <div className="nav-right">
          <div className="coins-badge">
            <div className="coin-icon">✦</div>
            {(coinData?.balance ?? 0).toLocaleString()}
          </div>
          <button className="nav-btn" onClick={() => setLocation("/shop")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Shop
          </button>
        </div>
      </nav>

      <div className="page">
        {/* Preview banner showing the currently equipped kart */}
        {data && (
          <div className="preview-banner">
            <div className="preview-kart-area">
              <div style={{ fontFamily: "Playfair Display, serif", fontSize: "2rem",
                color: "var(--blue)", fontWeight: 900, letterSpacing: "-0.02em" }}>
                {(data.cars.find((c) => c.key === data.equippedCarSkin)?.name ?? "?")
                  .split("")[0].toUpperCase()}
              </div>
            </div>
            <div className="preview-info">
              <div className="preview-label">Currently Equipped</div>
              <div className="preview-name" id="previewName">
                {data.cars.find((c) => c.key === data.equippedCarSkin)?.name ?? "?"}
              </div>
              <div className="preview-badges">
                <span className="preview-badge pbadge-blue">Kart Skin</span>
                <span className="preview-badge pbadge-green">Equipped</span>
              </div>
            </div>
            <button className="equip-btn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Equipped
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)" }}>
            Loading skins…
          </div>
        )}
        {error && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#dc2626" }}>
            Failed to load skins.
          </div>
        )}

        {/* The mock body — sections, grids, cards. State is overlaid via useEffect. */}
        <div dangerouslySetInnerHTML={{ __html: SKINS_MOCK_BODY }} />
      </div>

      <p style={{
        textAlign: "center", color: "var(--muted)", fontSize: "0.78rem",
        padding: "0 28px 40px", maxWidth: 720, margin: "0 auto", lineHeight: 1.6,
        position: "relative", zIndex: 1,
      }}>
        Equipped skins load from the host of every sprint room you create. They appear in
        spectator, regular, kart, and goal modes — never in boss or gladiator matches.
      </p>
    </div>
  );
}
