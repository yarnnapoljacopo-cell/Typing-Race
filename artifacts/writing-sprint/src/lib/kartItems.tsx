import type { ReactNode } from "react";

export type ItemKey =
  | "red_shell" | "green_shell" | "banana" | "star"
  | "blue_shell" | "lightning" | "mushroom" | "mystery_box"
  | "boo" | "golden_pen";

export type ItemTier = "common" | "rare" | "epic" | "legendary";

export interface ItemDef {
  key: ItemKey;
  emoji: string;        // kept for WS messages, toasts, hit notifications
  label: string;
  desc: string;
  color: string;        // primary accent
  bgColor: string;      // translucent bg fill (legacy, still used in help panel)
  tier: ItemTier;
  /** Custom rendered icon for inventory slots and the help panel. */
  Icon: (props: { size?: number }) => ReactNode;
  /** Two-stop gradient used for the slot background. */
  gradient: [string, string];
}

// ── Tier styling tokens ──────────────────────────────────────────────────
export const TIER_STYLES: Record<ItemTier, {
  ring: string;          // outer ring color
  glow: string;          // box-shadow glow
  badge: string;         // small uppercase label
  badgeColor: string;
}> = {
  common: {
    ring: "rgba(148,163,184,0.55)",
    glow: "0 0 10px rgba(148,163,184,0.25)",
    badge: "Common",
    badgeColor: "#cbd5e1",
  },
  rare: {
    ring: "rgba(59,130,246,0.75)",
    glow: "0 0 14px rgba(59,130,246,0.45)",
    badge: "Rare",
    badgeColor: "#93c5fd",
  },
  epic: {
    ring: "rgba(168,85,247,0.85)",
    glow: "0 0 18px rgba(168,85,247,0.55), inset 0 0 12px rgba(168,85,247,0.18)",
    badge: "Epic",
    badgeColor: "#d8b4fe",
  },
  legendary: {
    ring: "rgba(253,224,71,0.95)",
    glow: "0 0 22px rgba(253,224,71,0.75), inset 0 0 14px rgba(253,224,71,0.25)",
    badge: "Legendary",
    badgeColor: "#fde047",
  },
};

// ── Reusable SVG building blocks ─────────────────────────────────────────
const FILTER_DROP = (
  <filter id="kart-drop" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="1.2" stdDeviation="0.9" floodOpacity="0.35" />
  </filter>
);

function withDefs(uid: string, defs: ReactNode, body: ReactNode, size = 32) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        {FILTER_DROP}
        {defs}
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g filter="url(#kart-drop)">{body}</g>
    </svg>
  );
}

// ── Individual icon components ───────────────────────────────────────────
function ShellIcon({
  size,
  topColor,
  bottomColor,
  spotColor,
  uid,
}: { size?: number; topColor: string; bottomColor: string; spotColor: string; uid: string }) {
  return withDefs(
    uid,
    <>
      <radialGradient id={`${uid}-top`} cx="0.4" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="0.35" stopColor={topColor} />
        <stop offset="1" stopColor={bottomColor} />
      </radialGradient>
    </>,
    <>
      {/* belly */}
      <ellipse cx="16" cy="22" rx="12" ry="3.5" fill="#fef3c7" stroke="#a16207" strokeWidth="0.7" />
      {/* dome */}
      <path
        d="M 4 21 Q 4 7 16 6 Q 28 7 28 21 Z"
        fill={`url(#${uid}-top)`}
        stroke="#1f2937"
        strokeWidth="0.9"
      />
      {/* spots */}
      <circle cx="11" cy="13" r="2.2" fill={spotColor} stroke="#1f2937" strokeWidth="0.6" />
      <circle cx="21" cy="13" r="2.2" fill={spotColor} stroke="#1f2937" strokeWidth="0.6" />
      <circle cx="16" cy="18" r="2" fill={spotColor} stroke="#1f2937" strokeWidth="0.6" />
      {/* highlight */}
      <path d="M 8 14 Q 11 9 17 8" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
    </>,
    size,
  );
}

function BananaIcon({ size }: { size?: number }) {
  return withDefs(
    "ban",
    <>
      <linearGradient id="ban-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fef9c3" />
        <stop offset="0.5" stopColor="#facc15" />
        <stop offset="1" stopColor="#a16207" />
      </linearGradient>
    </>,
    <>
      <path
        d="M 5 9 Q 4 22 17 26 Q 28 28 27 19 Q 25 22 18 21 Q 9 19 8 9 Z"
        fill="url(#ban-body)"
        stroke="#713f12"
        strokeWidth="0.9"
      />
      <path d="M 5 9 L 7 6 L 9 8" fill="none" stroke="#3f2d0f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 27 19 L 28 16" fill="none" stroke="#3f2d0f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 7 12 Q 7 22 17 24" fill="none" stroke="#fef3c7" strokeOpacity="0.8" strokeWidth="1" strokeLinecap="round" />
    </>,
    size,
  );
}

function StarIcon({ size }: { size?: number }) {
  return withDefs(
    "star",
    <>
      <radialGradient id="star-body" cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fffbe6" />
        <stop offset="0.45" stopColor="#fde047" />
        <stop offset="1" stopColor="#b45309" />
      </radialGradient>
    </>,
    <>
      {/* sparkle rays */}
      <g stroke="#fde047" strokeWidth="1.1" strokeLinecap="round" opacity="0.75">
        <line x1="16" y1="1" x2="16" y2="4" />
        <line x1="16" y1="28" x2="16" y2="31" />
        <line x1="1" y1="16" x2="4" y2="16" />
        <line x1="28" y1="16" x2="31" y2="16" />
      </g>
      <polygon
        points="16,3 20,12 30,13 22,19 25,29 16,23 7,29 10,19 2,13 12,12"
        fill="url(#star-body)"
        stroke="#7c2d12"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <circle cx="13" cy="16" r="1.2" fill="#1f2937" />
      <circle cx="19" cy="16" r="1.2" fill="#1f2937" />
      <circle cx="13.4" cy="15.6" r="0.4" fill="#fff" />
      <circle cx="19.4" cy="15.6" r="0.4" fill="#fff" />
      {/* shine */}
      <path d="M 9 10 Q 12 6 17 6" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.1" strokeLinecap="round" />
    </>,
    size,
  );
}

function BlueShellIcon({ size }: { size?: number }) {
  return withDefs(
    "blue",
    <>
      <radialGradient id="blue-top" cx="0.4" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#dbeafe" />
        <stop offset="0.4" stopColor="#3b82f6" />
        <stop offset="1" stopColor="#1e3a8a" />
      </radialGradient>
    </>,
    <>
      <ellipse cx="16" cy="22" rx="12" ry="3.5" fill="#fef3c7" stroke="#1e3a8a" strokeWidth="0.7" />
      <path d="M 4 21 Q 4 7 16 6 Q 28 7 28 21 Z" fill="url(#blue-top)" stroke="#0f172a" strokeWidth="0.9" />
      {/* spikes */}
      <g fill="#0f172a" stroke="#dbeafe" strokeWidth="0.4">
        <polygon points="16,3 14,8 18,8" />
        <polygon points="9,8 7,12 11,12" />
        <polygon points="23,8 21,12 25,12" />
      </g>
      <circle cx="16" cy="16" r="2" fill="#dbeafe" stroke="#0f172a" strokeWidth="0.6" />
      <path d="M 8 14 Q 11 9 17 8" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.1" strokeLinecap="round" />
    </>,
    size,
  );
}

function LightningIcon({ size }: { size?: number }) {
  return withDefs(
    "lit",
    <>
      <linearGradient id="lit-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fef9c3" />
        <stop offset="0.5" stopColor="#facc15" />
        <stop offset="1" stopColor="#b45309" />
      </linearGradient>
      <radialGradient id="lit-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fde047" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fde047" stopOpacity="0" />
      </radialGradient>
    </>,
    <>
      <circle cx="16" cy="16" r="14" fill="url(#lit-glow)" />
      <polygon
        points="18,2 6,18 14,18 12,30 26,12 18,12"
        fill="url(#lit-body)"
        stroke="#7c2d12"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <polyline
        points="18,4 9,17 14,17"
        fill="none"
        stroke="#fffbe6"
        strokeOpacity="0.8"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>,
    size,
  );
}

function MushroomIcon({ size }: { size?: number }) {
  return withDefs(
    "msh",
    <>
      <radialGradient id="msh-cap" cx="0.4" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#fecaca" />
        <stop offset="0.45" stopColor="#ef4444" />
        <stop offset="1" stopColor="#7f1d1d" />
      </radialGradient>
    </>,
    <>
      {/* stem */}
      <path d="M 11 19 Q 11 27 13 28 L 19 28 Q 21 27 21 19 Z" fill="#fef3c7" stroke="#78350f" strokeWidth="0.8" />
      <ellipse cx="14" cy="25" rx="0.9" ry="1.4" fill="#1f2937" />
      <ellipse cx="18" cy="25" rx="0.9" ry="1.4" fill="#1f2937" />
      <ellipse cx="14.4" cy="24.6" rx="0.3" ry="0.5" fill="#fff" />
      <ellipse cx="18.4" cy="24.6" rx="0.3" ry="0.5" fill="#fff" />
      {/* cap */}
      <path d="M 4 18 Q 4 5 16 4 Q 28 5 28 18 Z" fill="url(#msh-cap)" stroke="#1f2937" strokeWidth="0.9" />
      <ellipse cx="11" cy="11" rx="2.4" ry="2" fill="#fef3c7" stroke="#1f2937" strokeWidth="0.5" />
      <ellipse cx="20" cy="9" rx="3" ry="2.4" fill="#fef3c7" stroke="#1f2937" strokeWidth="0.5" />
      <ellipse cx="22" cy="15" rx="1.6" ry="1.3" fill="#fef3c7" stroke="#1f2937" strokeWidth="0.5" />
      <path d="M 7 13 Q 9 7 15 6" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
    </>,
    size,
  );
}

function MysteryBoxIcon({ size }: { size?: number }) {
  return withDefs(
    "mys",
    <>
      <linearGradient id="mys-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a78bfa" />
        <stop offset="1" stopColor="#5b21b6" />
      </linearGradient>
      <linearGradient id="mys-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c4b5fd" />
        <stop offset="1" stopColor="#7c3aed" />
      </linearGradient>
    </>,
    <>
      {/* body */}
      <rect x="5" y="13" width="22" height="15" rx="1.6" fill="url(#mys-body)" stroke="#1f2937" strokeWidth="0.9" />
      {/* lid */}
      <rect x="4" y="10" width="24" height="5" rx="1.2" fill="url(#mys-lid)" stroke="#1f2937" strokeWidth="0.9" />
      {/* ribbon vertical */}
      <rect x="14.5" y="10" width="3" height="18" fill="#facc15" stroke="#1f2937" strokeWidth="0.5" />
      {/* ribbon horizontal */}
      <rect x="4" y="11.5" width="24" height="2.4" fill="#facc15" stroke="#1f2937" strokeWidth="0.5" />
      {/* bow */}
      <path d="M 11 9 Q 14 5 16 10 Q 18 5 21 9 Q 18 11 16 10 Q 14 11 11 9 Z" fill="#facc15" stroke="#1f2937" strokeWidth="0.6" />
      <text x="16" y="24" textAnchor="middle" fontSize="6" fontWeight="900" fill="#fef3c7" stroke="#1f2937" strokeWidth="0.4" fontFamily="system-ui, sans-serif">?</text>
    </>,
    size,
  );
}

function BooIcon({ size }: { size?: number }) {
  return withDefs(
    "boo",
    <>
      <radialGradient id="boo-body" cx="0.4" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#e5e7eb" />
        <stop offset="1" stopColor="#94a3b8" />
      </radialGradient>
    </>,
    <>
      <path
        d="M 5 14 Q 5 4 16 4 Q 27 4 27 14 L 27 27 Q 24 24 22 27 Q 19 24 16 27 Q 13 24 10 27 Q 8 24 5 27 Z"
        fill="url(#boo-body)"
        stroke="#1f2937"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <ellipse cx="12" cy="14" rx="1.7" ry="2.2" fill="#1f2937" />
      <ellipse cx="20" cy="14" rx="1.7" ry="2.2" fill="#1f2937" />
      <ellipse cx="12.6" cy="13.4" rx="0.5" ry="0.7" fill="#fff" />
      <ellipse cx="20.6" cy="13.4" rx="0.5" ry="0.7" fill="#fff" />
      {/* mouth */}
      <ellipse cx="16" cy="19" rx="2.4" ry="1.6" fill="#1f2937" />
      <ellipse cx="16" cy="18.6" rx="1.2" ry="0.6" fill="#fda4af" />
      {/* fangs */}
      <polygon points="14.5,18 15,20 15.5,18" fill="#fff" />
      <polygon points="16.5,18 17,20 17.5,18" fill="#fff" />
    </>,
    size,
  );
}

function GoldenPenIcon({ size }: { size?: number }) {
  return withDefs(
    "pen",
    <>
      <linearGradient id="pen-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fffbe6" />
        <stop offset="0.4" stopColor="#fde047" />
        <stop offset="1" stopColor="#a16207" />
      </linearGradient>
      <linearGradient id="pen-nib" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fef9c3" />
        <stop offset="1" stopColor="#854d0e" />
      </linearGradient>
      <radialGradient id="pen-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fde047" stopOpacity="0.6" />
        <stop offset="1" stopColor="#fde047" stopOpacity="0" />
      </radialGradient>
    </>,
    <>
      <circle cx="16" cy="16" r="14" fill="url(#pen-glow)" />
      {/* barrel */}
      <rect
        x="6" y="14"
        width="14" height="4"
        rx="1.2"
        fill="url(#pen-body)"
        stroke="#3f2d0f"
        strokeWidth="0.8"
        transform="rotate(-30 13 16)"
      />
      {/* cap ring */}
      <rect
        x="14" y="13.4"
        width="2.5" height="5.2"
        fill="#854d0e"
        stroke="#3f2d0f"
        strokeWidth="0.6"
        transform="rotate(-30 15.25 16)"
      />
      {/* nib */}
      <polygon
        points="22,10 28,7 26,14"
        fill="url(#pen-nib)"
        stroke="#3f2d0f"
        strokeWidth="0.7"
      />
      <line x1="24" y1="9.5" x2="26" y2="12" stroke="#3f2d0f" strokeWidth="0.6" />
      {/* ink dot */}
      <circle cx="28.2" cy="6.6" r="1.1" fill="#1e3a8a" stroke="#3f2d0f" strokeWidth="0.4" />
      {/* sparkles */}
      <g fill="#fffbe6">
        <polygon points="3,7 4,9 6,10 4,11 3,13 2,11 0,10 2,9" opacity="0.85" />
        <polygon points="26,22 27,24 29,25 27,26 26,28 25,26 23,25 25,24" opacity="0.7" />
      </g>
    </>,
    size,
  );
}

// ── Item registry ────────────────────────────────────────────────────────
export const ITEMS: Record<ItemKey, ItemDef> = {
  red_shell: {
    key: "red_shell", emoji: "🔴", label: "Red Shell", tier: "rare",
    color: "#ef4444", bgColor: "rgba(239,68,68,0.18)",
    gradient: ["#7f1d1d", "#ef4444"],
    desc: "Blurs the word counter of the writer directly ahead for 20s",
    Icon: ({ size }) => (
      <ShellIcon size={size} uid="rs" topColor="#ef4444" bottomColor="#7f1d1d" spotColor="#fef3c7" />
    ),
  },
  green_shell: {
    key: "green_shell", emoji: "🟢", label: "Green Shell", tier: "common",
    color: "#22c55e", bgColor: "rgba(34,197,94,0.18)",
    gradient: ["#14532d", "#22c55e"],
    desc: "Fires randomly at any writer — could hit you too",
    Icon: ({ size }) => (
      <ShellIcon size={size} uid="gs" topColor="#22c55e" bottomColor="#14532d" spotColor="#fef3c7" />
    ),
  },
  banana: {
    key: "banana", emoji: "🍌", label: "Banana Peel", tier: "common",
    color: "#eab308", bgColor: "rgba(234,179,8,0.18)",
    gradient: ["#713f12", "#facc15"],
    desc: "Next writer to overtake you gets bold text for 5s",
    Icon: ({ size }) => <BananaIcon size={size} />,
  },
  star: {
    key: "star", emoji: "⭐", label: "Star", tier: "epic",
    color: "#fbbf24", bgColor: "rgba(251,191,36,0.18)",
    gradient: ["#7c2d12", "#fbbf24"],
    desc: "30s invincibility — all items bounce off you",
    Icon: ({ size }) => <StarIcon size={size} />,
  },
  blue_shell: {
    key: "blue_shell", emoji: "🔵", label: "Blue Shell", tier: "epic",
    color: "#3b82f6", bgColor: "rgba(59,130,246,0.18)",
    gradient: ["#1e3a8a", "#3b82f6"],
    desc: "Smashes 1st place — knocks their car back 200 words",
    Icon: ({ size }) => <BlueShellIcon size={size} />,
  },
  lightning: {
    key: "lightning", emoji: "⚡", label: "Lightning", tier: "epic",
    color: "#f59e0b", bgColor: "rgba(245,158,11,0.18)",
    gradient: ["#7c2d12", "#fbbf24"],
    desc: "Hits every other writer — −300 car words each",
    Icon: ({ size }) => <LightningIcon size={size} />,
  },
  mushroom: {
    key: "mushroom", emoji: "🍄", label: "Mushroom", tier: "common",
    color: "#f97316", bgColor: "rgba(249,115,22,0.18)",
    gradient: ["#7f1d1d", "#f97316"],
    desc: "Boost your car forward by 200 words",
    Icon: ({ size }) => <MushroomIcon size={size} />,
  },
  mystery_box: {
    key: "mystery_box", emoji: "🎁", label: "Mystery Box", tier: "rare",
    color: "#8b5cf6", bgColor: "rgba(139,92,246,0.18)",
    gradient: ["#4c1d95", "#a78bfa"],
    desc: "Contains 3 random items at once",
    Icon: ({ size }) => <MysteryBoxIcon size={size} />,
  },
  boo: {
    key: "boo", emoji: "👻", label: "Boo", tier: "rare",
    color: "#9ca3af", bgColor: "rgba(156,163,175,0.18)",
    gradient: ["#334155", "#cbd5e1"],
    desc: "Steals an item from the writer directly ahead",
    Icon: ({ size }) => <BooIcon size={size} />,
  },
  golden_pen: {
    key: "golden_pen", emoji: "🌟", label: "Golden Pen", tier: "legendary",
    color: "#fde047", bgColor: "rgba(253,224,71,0.18)",
    gradient: ["#a16207", "#fde047"],
    desc: "Extremely rare! +400 REAL bonus words added to your final count",
    Icon: ({ size }) => <GoldenPenIcon size={size} />,
  },
};

export const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];
