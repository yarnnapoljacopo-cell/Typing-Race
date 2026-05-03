import type { CSSProperties, ReactNode } from "react";

export type SkinRarity = "common" | "rare" | "epic" | "legendary" | "ultra";

export interface CarSkinDef {
  key: string;
  name: string;
  rarity: SkinRarity;
  unlocked: boolean;
}

export interface RoadSkinDef {
  key: string;
  name: string;
  rarity: SkinRarity;
  unlocked: boolean;
}

export const RARITY_COLOR: Record<SkinRarity, string> = {
  common: "#94a3b8",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
  ultra: "#ec4899",
};

// ── Per-skin colour palette used by the SVG renderers below ──────────────────
interface CarPalette { car: string; shade: string; light: string; trim?: string; }

const CAR_PALETTES: Record<string, CarPalette> = {
  bluebird:  { car: "#3B82F6", shade: "#1D4ED8", light: "#60A5FA" },
  firebolt:  { car: "#ef4444", shade: "#991b1b", light: "#fca5a5", trim: "#fbbf24" },
  jade:      { car: "#10b981", shade: "#047857", light: "#6ee7b7", trim: "#fde68a" },
  shadow:    { car: "#1f2937", shade: "#0b1220", light: "#4b5563", trim: "#a78bfa" },
  crimson:   { car: "#7f1d1d", shade: "#450a0a", light: "#dc2626", trim: "#f59e0b" },
  royal:     { car: "#6d28d9", shade: "#3b0764", light: "#a78bfa", trim: "#fde047" },
  gilded:    { car: "#d97706", shade: "#92400e", light: "#fde68a", trim: "#fef3c7" },
  void:      { car: "#0f172a", shade: "#020617", light: "#1e293b", trim: "#10b981" },
  arctic:    { car: "#7dd3fc", shade: "#0369a1", light: "#e0f9ff", trim: "#bae6fd" },
  sakura:    { car: "#ec4899", shade: "#9d174d", light: "#fbcfe8", trim: "#fce7f3" },
  thunder:   { car: "#1c1917", shade: "#0c0a09", light: "#44403c", trim: "#fbbf24" },
  cyber:     { car: "#003d1a", shade: "#001a0a", light: "#00ff88", trim: "#00ff88" },
  celestial: { car: "#4400b3", shade: "#1a0050", light: "#a78bfa", trim: "#fde047" },
  inferno:   { car: "#dc2626", shade: "#7f1d1d", light: "#fbbf24", trim: "#facc15" },
};

export function getCarPalette(key: string | null | undefined): CarPalette {
  return CAR_PALETTES[key ?? "bluebird"] ?? CAR_PALETTES.bluebird;
}

// ── Road / track skin styling: backgrounds and decorative overlays ──────────

interface RoadStyle {
  trackBg: string;        // CSS background for the regular-mode race track surface
  kartSky: string;        // CSS background for the kart-mode header
  kartRoad: string;       // CSS background for the kart-mode road
  topKerb: string;        // repeating-linear-gradient for top kerb
  bottomKerb: string;     // repeating-linear-gradient for bottom kerb
  laneTint: string;       // subtle overlay for each lane in regular mode
}

const ROAD_STYLES: Record<string, RoadStyle> = {
  mushroom: {
    trackBg: "#2d4a1e",
    kartSky: "linear-gradient(180deg, #1a1040 0%, #2a1a60 40%, #3a2a20 100%)",
    kartRoad: "linear-gradient(180deg, #2a2035 0%, #1e1830 100%)",
    topKerb: "repeating-linear-gradient(90deg, #e53e3e 0px, #e53e3e 18px, white 18px, white 36px)",
    bottomKerb: "repeating-linear-gradient(90deg, #2b6cb0 0px, #2b6cb0 18px, white 18px, white 36px)",
    laneTint: "rgba(255,255,255,0.04)",
  },
  ghost: {
    trackBg: "linear-gradient(180deg, #1a1232 0%, #2a1a4a 100%)",
    kartSky: "linear-gradient(180deg, #0a0218 0%, #1a0832 40%, #2a1248 100%)",
    kartRoad: "linear-gradient(180deg, #150a28 0%, #0a0418 100%)",
    topKerb: "repeating-linear-gradient(90deg, #6d28d9 0px, #6d28d9 18px, #1e1b4b 18px, #1e1b4b 36px)",
    bottomKerb: "repeating-linear-gradient(90deg, #4c1d95 0px, #4c1d95 18px, #1e1b4b 18px, #1e1b4b 36px)",
    laneTint: "rgba(167,139,250,0.06)",
  },
  volcano: {
    trackBg: "linear-gradient(180deg, #3b0a02 0%, #1f0500 100%)",
    kartSky: "linear-gradient(180deg, #2a0a02 0%, #5a1808 40%, #7a2a10 100%)",
    kartRoad: "linear-gradient(180deg, #2a0a02 0%, #150500 100%)",
    topKerb: "repeating-linear-gradient(90deg, #ea580c 0px, #ea580c 18px, #fde047 18px, #fde047 36px)",
    bottomKerb: "repeating-linear-gradient(90deg, #b91c1c 0px, #b91c1c 18px, #fbbf24 18px, #fbbf24 36px)",
    laneTint: "rgba(251,146,60,0.05)",
  },
};

export function getRoadStyle(key: string | null | undefined): RoadStyle {
  return ROAD_STYLES[key ?? "mushroom"] ?? ROAD_STYLES.mushroom;
}

// ── SVG renderers ────────────────────────────────────────────────────────────

const CAR_W = 48;

export function SkinnedCar({ skinKey, color }: { skinKey: string | null | undefined; color?: string }) {
  const p = getCarPalette(skinKey);
  const body = color ?? p.car;
  const shade = color ?? p.shade;
  return (
    <svg viewBox="0 0 48 24" width={CAR_W} height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="40" height="12" rx="3" fill={body} />
      <path d="M12 8 L16 2 L32 2 L36 8 Z" fill={shade} opacity="0.85" />
      <path d="M17 8 L19 4 L29 4 L31 8 Z" fill="white" opacity="0.5" />
      {p.trim && <rect x="4" y="13" width="40" height="2" fill={p.trim} opacity="0.7" />}
      <circle cx="36" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="36" cy="20" r="2" fill="#666" />
      <circle cx="12" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="12" cy="20" r="2" fill="#666" />
      <rect x="42" y="11" width="3" height="4" rx="1" fill="#fde68a" />
      <rect x="3" y="11" width="3" height="4" rx="1" fill="#fca5a5" />
    </svg>
  );
}

export function SkinnedKart({ skinKey, laneNum, fallbackColor, fallbackShade, fallbackLight }: {
  skinKey: string | null | undefined;
  laneNum: number;
  fallbackColor?: string;
  fallbackShade?: string;
  fallbackLight?: string;
}) {
  const p = getCarPalette(skinKey);
  const car = fallbackColor ?? p.car;
  const shade = fallbackShade ?? p.shade;
  const light = fallbackLight ?? p.light;
  return (
    <svg width="52" height="30" viewBox="0 0 52 30" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
      <path d="M6 18 Q6 14 10 14 L40 14 Q45 14 46 18 L46 22 Q46 24 44 24 L8 24 Q6 24 6 22 Z" fill={car} />
      <path d="M10 14 L14 10 L36 10 L40 14 Z" fill={shade} />
      <path d="M18 14 L20 9 L30 9 L32 14 Z" fill="rgba(180,220,255,0.7)" />
      <path d="M18 14 L20 9 L30 9 L32 14" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none" />
      <path d="M40 14 L48 17 L46 22 L40 22 Z" fill={shade} />
      {p.trim && <rect x="10" y="17" width="30" height="1.4" fill={p.trim} opacity="0.85" />}
      <rect x="4" y="11" width="2" height="6" rx="1" fill={shade} />
      <rect x="2" y="10" width="6" height="2" rx="1" fill={light} />
      <path d="M44 18 L50 16 L51 19 L46 21 Z" fill={light} />
      <ellipse cx="14" cy="25" rx="5" ry="4" fill="#111827" />
      <ellipse cx="14" cy="25" rx="3" ry="2.5" fill="#374151" />
      <ellipse cx="14" cy="25" rx="1.2" ry="1" fill="#6B7280" />
      <ellipse cx="38" cy="25" rx="5" ry="4" fill="#111827" />
      <ellipse cx="38" cy="25" rx="3" ry="2.5" fill="#374151" />
      <ellipse cx="38" cy="25" rx="1.2" ry="1" fill="#6B7280" />
      <text x="24" y="20" textAnchor="middle" fontSize="5" fontWeight="900" fill="white"
        fontFamily="DM Sans, sans-serif" opacity="0.9">
        {String(laneNum).padStart(2, "0")}
      </text>
      <path d="M12 15 Q26 13 38 15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="47" cy="18" rx="2" ry="1.5" fill="#FEF08A" opacity="0.9" />
      <ellipse cx="47" cy="18" rx="4" ry="3" fill="rgba(254,240,138,0.2)" />
      <circle cx="5" cy="19" r="1" fill="#F97316" opacity="0.7" />
      <circle cx="3" cy="21" r="0.7" fill="#FBBF24" opacity="0.5" />
    </svg>
  );
}

// ── Preview cards used on the Skins page ────────────────────────────────────

export function CarSkinPreview({ skinKey, size = 90 }: { skinKey: string; size?: number }): ReactNode {
  const containerStyle: CSSProperties = {
    width: "100%", height: size,
    background: "linear-gradient(180deg, #2d4a1e 0%, #1e3214 100%)",
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  };
  return (
    <div style={containerStyle}>
      <div style={{ transform: "scale(1.3)" }}>
        <SkinnedKart skinKey={skinKey} laneNum={1} />
      </div>
    </div>
  );
}

export function RoadSkinPreview({ skinKey, size = 90 }: { skinKey: string; size?: number }): ReactNode {
  const style = getRoadStyle(skinKey);
  const containerStyle: CSSProperties = {
    width: "100%", height: size,
    background: style.trackBg,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
    display: "flex", flexDirection: "column", justifyContent: "space-between",
  };
  return (
    <div style={containerStyle}>
      <div style={{ height: 8, background: style.topKerb, opacity: 0.85 }} />
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{
          position: "absolute", top: "50%", left: 8, right: 8,
          transform: "translateY(-50%)",
          borderTop: "2px dashed rgba(255,255,255,0.35)",
        }} />
      </div>
      <div style={{ height: 8, background: style.bottomKerb, opacity: 0.85 }} />
    </div>
  );
}

// ── Mode gating ─────────────────────────────────────────────────────────────
// Skins should be applied only to spectator (open mode), regular, kart, and goal modes.
// Boss and gladiator modes never use car/road skins.
export function shouldApplySkins(mode: string | null | undefined): boolean {
  return mode === "regular" || mode === "open" || mode === "kart" || mode === "goal";
}
