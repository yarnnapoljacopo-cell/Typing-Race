export type ItemKey =
  | "red_shell" | "green_shell" | "banana" | "star"
  | "blue_shell" | "lightning" | "mushroom" | "mystery_box"
  | "boo" | "golden_pen";

export interface ItemDef {
  key: ItemKey;
  emoji: string;
  label: string;
  desc: string;
  color: string;
  bgColor: string;
}

export const ITEMS: Record<ItemKey, ItemDef> = {
  red_shell:   { key: "red_shell",   emoji: "🔴", label: "Red Shell",   color: "#ef4444", bgColor: "rgba(239,68,68,0.18)",    desc: "Blurs the word counter of the writer directly ahead for 20s" },
  green_shell: { key: "green_shell", emoji: "🟢", label: "Green Shell", color: "#22c55e", bgColor: "rgba(34,197,94,0.18)",    desc: "Fires randomly at any writer — could hit you too" },
  banana:      { key: "banana",      emoji: "🍌", label: "Banana Peel", color: "#eab308", bgColor: "rgba(234,179,8,0.18)",    desc: "Next writer to overtake you gets bold text for 5s" },
  star:        { key: "star",        emoji: "⭐", label: "Star",        color: "#fbbf24", bgColor: "rgba(251,191,36,0.18)",   desc: "30s invincibility — all items bounce off you" },
  blue_shell:  { key: "blue_shell",  emoji: "🔵", label: "Blue Shell",  color: "#3b82f6", bgColor: "rgba(59,130,246,0.18)",   desc: "Smashes 1st place — knocks their car back 200 words" },
  lightning:   { key: "lightning",   emoji: "⚡", label: "Lightning",   color: "#f59e0b", bgColor: "rgba(245,158,11,0.18)",   desc: "Hits every other writer — −300 car words each" },
  mushroom:    { key: "mushroom",    emoji: "🍄", label: "Mushroom",    color: "#f97316", bgColor: "rgba(249,115,22,0.18)",   desc: "Boost your car forward by 200 words" },
  mystery_box: { key: "mystery_box", emoji: "🎁", label: "Mystery Box", color: "#8b5cf6", bgColor: "rgba(139,92,246,0.18)",  desc: "Contains 3 random items at once" },
  boo:         { key: "boo",         emoji: "👻", label: "Boo",         color: "#9ca3af", bgColor: "rgba(156,163,175,0.18)", desc: "Steals an item from the writer directly ahead" },
  golden_pen:  { key: "golden_pen",  emoji: "🌟", label: "Golden Pen",  color: "#fde047", bgColor: "rgba(253,224,71,0.18)",  desc: "Extremely rare! +400 REAL bonus words added to your final count" },
};

export const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];
