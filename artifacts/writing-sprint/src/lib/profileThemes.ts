// Profile customization presets — banner gradients and accent colors.
// Both are stored on user_profiles as short string keys; unknown keys fall
// back to "default".

export type BannerKey =
  | "default" | "sunset" | "ocean" | "aurora"
  | "ember" | "void" | "forest" | "rose" | "midnight";

export interface BannerDef {
  key: BannerKey;
  label: string;
  /** CSS background applied to the banner strip. */
  background: string;
  /** Foreground color for the writer name overlaid on the banner. */
  text: string;
  /** Subtle pattern overlay (optional). */
  pattern?: string;
}

export const BANNERS: Record<BannerKey, BannerDef> = {
  default: {
    key: "default",
    label: "Parchment",
    background: "linear-gradient(135deg, #EFF3F8 0%, #E8E6DC 100%)",
    text: "#1a1a2e",
  },
  sunset: {
    key: "sunset",
    label: "Sunset",
    background: "linear-gradient(135deg, #f97316 0%, #ec4899 60%, #8b5cf6 100%)",
    text: "#ffffff",
  },
  ocean: {
    key: "ocean",
    label: "Ocean",
    background: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)",
    text: "#ffffff",
  },
  aurora: {
    key: "aurora",
    label: "Aurora",
    background: "linear-gradient(135deg, #8b5cf6 0%, #22d3ee 50%, #10b981 100%)",
    text: "#ffffff",
  },
  ember: {
    key: "ember",
    label: "Ember",
    background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f59e0b 100%)",
    text: "#ffffff",
  },
  void: {
    key: "void",
    label: "Void",
    background: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #6d28d9 100%)",
    text: "#ffffff",
  },
  forest: {
    key: "forest",
    label: "Forest",
    background: "linear-gradient(135deg, #064e3b 0%, #15803d 60%, #84cc16 100%)",
    text: "#ffffff",
  },
  rose: {
    key: "rose",
    label: "Rose",
    background: "linear-gradient(135deg, #fda4af 0%, #ec4899 50%, #be185d 100%)",
    text: "#ffffff",
  },
  midnight: {
    key: "midnight",
    label: "Midnight",
    background: "radial-gradient(ellipse at top, #1e293b 0%, #020617 70%), linear-gradient(135deg, #1e1b4b, #0f172a)",
    text: "#e0e7ff",
    pattern: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 1px, transparent 1.5px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 1px, transparent 1.5px), radial-gradient(circle at 60% 20%, rgba(255,255,255,0.1) 1px, transparent 1.5px)",
  },
};

export function getBanner(key: string | null | undefined): BannerDef {
  return BANNERS[(key ?? "default") as BannerKey] ?? BANNERS.default;
}

export type AccentKey =
  | "default" | "blue" | "purple" | "pink"
  | "gold" | "teal" | "crimson" | "emerald";

export interface AccentDef {
  key: AccentKey;
  label: string;
  color: string;
  soft: string;
}

export const ACCENTS: Record<AccentKey, AccentDef> = {
  default: { key: "default", label: "Slate",   color: "#6B8FD4", soft: "rgba(107,143,212,0.12)" },
  blue:    { key: "blue",    label: "Sky",     color: "#3b82f6", soft: "rgba(59,130,246,0.12)" },
  purple:  { key: "purple",  label: "Purple",  color: "#a855f7", soft: "rgba(168,85,247,0.12)" },
  pink:    { key: "pink",    label: "Pink",    color: "#ec4899", soft: "rgba(236,72,153,0.12)" },
  gold:    { key: "gold",    label: "Gold",    color: "#f59e0b", soft: "rgba(245,158,11,0.12)" },
  teal:    { key: "teal",    label: "Teal",    color: "#14b8a6", soft: "rgba(20,184,166,0.12)" },
  crimson: { key: "crimson", label: "Crimson", color: "#dc2626", soft: "rgba(220,38,38,0.12)" },
  emerald: { key: "emerald", label: "Emerald", color: "#10b981", soft: "rgba(16,185,129,0.12)" },
};

export function getAccent(key: string | null | undefined): AccentDef {
  return ACCENTS[(key ?? "default") as AccentKey] ?? ACCENTS.default;
}
