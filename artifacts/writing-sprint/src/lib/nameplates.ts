import type { CSSProperties } from "react";

export type NameplateKey = "default" | "crimson" | "gold" | "blue" | "purple";
export type SkinKey = "default" | "eternal" | "final";

export interface NameplateDef {
  key: NameplateKey;
  label: string;
  color: string;
  glow: string;
  minXp: number;
  description: string;
}

export const NAMEPLATES: Record<NameplateKey, NameplateDef> = {
  default: {
    key: "default",
    label: "Default",
    color: "inherit",
    glow: "none",
    minXp: 0,
    description: "Standard nameplate",
  },
  crimson: {
    key: "crimson",
    label: "Crimson",
    color: "#dc2626",
    glow: "0 0 8px #dc262680",
    minXp: 10000,
    description: "Deep red — Ink Reaper perk",
  },
  gold: {
    key: "gold",
    label: "Golden",
    color: "#f59e0b",
    glow: "0 0 10px #f59e0b99",
    minXp: 25000,
    description: "Glowing gold — Grand Scribe perk",
  },
  blue: {
    key: "blue",
    label: "Cosmic Blue",
    color: "#60a5fa",
    glow: "0 0 12px #60a5faaa",
    minXp: 75000,
    description: "Cosmic blue — Eternal Quill perk",
  },
  purple: {
    key: "purple",
    label: "Royal Purple",
    color: "#a855f7",
    glow: "0 0 14px #a855f7bb",
    minXp: 200000,
    description: "Glowing purple — The Ranker perk",
  },
};

export function getNameplateStyle(nameplate: string | undefined): CSSProperties {
  const def = NAMEPLATES[(nameplate ?? "default") as NameplateKey];
  if (!def || def.key === "default") return {};
  return { color: def.color, textShadow: def.glow, fontWeight: 600 };
}

export function getUnlockedNameplates(xp: number): NameplateDef[] {
  return Object.values(NAMEPLATES).filter((n) => xp >= n.minXp);
}

export const SKINS: Record<SkinKey, { label: string; minXp: number; description: string }> = {
  default: { label: "Default", minXp: 0, description: "Standard writing canvas" },
  eternal: { label: "Eternal Skin", minXp: 75000, description: "Cosmic transformation — stars drift as you write, runic word count" },
  final: { label: "Final Skin", minXp: 200000, description: "Exclusive black & gold — ink animations that react to your typing speed" },
};
