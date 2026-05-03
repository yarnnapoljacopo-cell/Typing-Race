import type { ReactNode, SVGProps } from "react";

const BLUE = "#6B8FD4";
const GOLD = "#E8A838";
const INK = "#1a1a2e";
const CREAM = "#F6F1E7";

type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

const stroke = {
  stroke: INK,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function TooSlowSnail({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5 22h17a4 4 0 0 0 0-8 4 4 0 0 0-4 4" {...stroke} fill={CREAM} />
      <circle cx="20" cy="14" r="4.5" {...stroke} fill={BLUE} fillOpacity="0.18" />
      <circle cx="20" cy="14" r="2" {...stroke} fill={GOLD} fillOpacity="0.6" />
      <path d="M22 7v3M24 8l-1.5 2" {...stroke} />
      <circle cx="22.5" cy="6.5" r="0.9" fill={INK} />
      <circle cx="24.5" cy="7.5" r="0.9" fill={INK} />
    </svg>
  );
}

function HahaBubble({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5 8a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-9l-5 4v-4H8a3 3 0 0 1-3-3z" {...stroke} fill={CREAM} />
      <text x="16" y="17" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="9" fill={BLUE}>HA!</text>
    </svg>
  );
}

function EatDustFlag({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 4v24" {...stroke} />
      <path d="M8 5h14v10H8z" {...stroke} fill={CREAM} />
      <rect x="8" y="5" width="3.5" height="3.3" fill={INK} />
      <rect x="15" y="5" width="3.5" height="3.3" fill={INK} />
      <rect x="11.5" y="8.3" width="3.5" height="3.3" fill={INK} />
      <rect x="18.5" y="8.3" width="3.5" height="3.3" fill={INK} />
      <rect x="8" y="11.6" width="3.5" height="3.4" fill={INK} />
      <rect x="15" y="11.6" width="3.5" height="3.4" fill={INK} />
      <path d="M3 22c2-1 4-1 6 0M3 26c2-1 4-1 6 0" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CatchUpArrows({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4 12h12l-3-3M4 12l3 3" {...stroke} />
      <path d="M12 20h16l-3-3M12 20l3 3" {...stroke} stroke={BLUE} />
      <circle cx="28" cy="20" r="1.5" fill={GOLD} />
    </svg>
  );
}

function OnFireFlame({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <defs>
        <linearGradient id="flameG" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#dc2626" />
          <stop offset="0.6" stopColor={GOLD} />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      <path d="M16 3c1 4 5 6 5 11a5 5 0 1 1-10 0c0-2 1-3 1-4-2 1-3 3-3 6a8 8 0 0 0 16 0c0-7-7-8-9-13z" fill="url(#flameG)" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 22c0-2 1.5-3 1.5-4.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BowDownCrown({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M4 22l2-12 5 5 5-9 5 9 5-5 2 12z" {...stroke} fill={GOLD} fillOpacity="0.45" />
      <path d="M5 25h22" {...stroke} />
      <circle cx="6" cy="10" r="1.2" fill={GOLD} stroke={INK} strokeWidth="0.8" />
      <circle cx="16" cy="6" r="1.4" fill={GOLD} stroke={INK} strokeWidth="0.8" />
      <circle cx="26" cy="10" r="1.2" fill={GOLD} stroke={INK} strokeWidth="0.8" />
    </svg>
  );
}

function WriteFasterQuill({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M22 5c-9 0-15 7-15 15 4 0 7-1 9-3" {...stroke} fill={CREAM} />
      <path d="M14 14l8-9" {...stroke} />
      <path d="M7 22l5-5" {...stroke} stroke={BLUE} />
      <path d="M3 19l3-3M3 23l4-4M3 27l5-5" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="22" cy="5" r="1.5" fill={GOLD} />
    </svg>
  );
}

function GoodLuckClover({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="11" cy="11" r="5" {...stroke} fill={BLUE} fillOpacity="0.25" />
      <circle cx="21" cy="11" r="5" {...stroke} fill={BLUE} fillOpacity="0.25" />
      <circle cx="11" cy="21" r="5" {...stroke} fill={BLUE} fillOpacity="0.25" />
      <circle cx="21" cy="21" r="5" {...stroke} fill={BLUE} fillOpacity="0.25" />
      <circle cx="16" cy="16" r="2" fill={GOLD} stroke={INK} strokeWidth="0.8" />
      <path d="M16 18c0 4-2 8-5 10" {...stroke} />
    </svg>
  );
}

function BringItSwords({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6 4l16 16" {...stroke} />
      <path d="M26 4L10 20" {...stroke} />
      <path d="M5 5l3 3-2 2-3-3z" {...stroke} fill={GOLD} fillOpacity="0.5" />
      <path d="M27 5l-3 3 2 2 3-3z" {...stroke} fill={GOLD} fillOpacity="0.5" />
      <path d="M22 20l5 5M10 20l-5 5" {...stroke} stroke={BLUE} />
      <circle cx="16" cy="16" r="2.2" fill={CREAM} stroke={INK} strokeWidth="1.4" />
    </svg>
  );
}

function WakeUpClock({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="16" cy="18" r="9" {...stroke} fill={CREAM} />
      <path d="M16 13v5l3 2" {...stroke} stroke={BLUE} />
      <path d="M6 8L4 6M26 8l2-2" {...stroke} />
      <path d="M5 11l-2 1M27 11l2 1" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6" cy="8" r="1.6" fill={GOLD} stroke={INK} strokeWidth="0.9" />
      <circle cx="26" cy="8" r="1.6" fill={GOLD} stroke={INK} strokeWidth="0.9" />
    </svg>
  );
}

function BigBrain({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M11 6a4 4 0 0 0-4 4 3 3 0 0 0-2 5 3 3 0 0 0 2 5 4 4 0 0 0 4 4h2V6z" {...stroke} fill={BLUE} fillOpacity="0.28" />
      <path d="M21 6a4 4 0 0 1 4 4 3 3 0 0 1 2 5 3 3 0 0 1-2 5 4 4 0 0 1-4 4h-2V6z" {...stroke} fill={BLUE} fillOpacity="0.28" />
      <path d="M16 6v18" {...stroke} />
      <path d="M11 11c1 1 2 1 3 0M21 11c-1 1-2 1-3 0M11 19c1-1 2-1 3 0M21 19c-1-1-2-1-3 0" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M27 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={GOLD} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

function GgTrophy({ size = 28, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M10 5h12v6a6 6 0 0 1-12 0z" {...stroke} fill={GOLD} fillOpacity="0.55" />
      <path d="M10 7H6v2a4 4 0 0 0 4 4M22 7h4v2a4 4 0 0 1-4 4" {...stroke} />
      <path d="M14 17h4v3h2v3h-8v-3h2z" {...stroke} fill={CREAM} />
      <text x="16" y="11" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="6" fill={INK}>★</text>
    </svg>
  );
}

const ICON_BY_ID: Record<string, (p: IconProps) => ReactNode> = {
  too_slow: TooSlowSnail,
  haha: HahaBubble,
  eat_dust: EatDustFlag,
  catch_up: CatchUpArrows,
  on_fire: OnFireFlame,
  bow_down: BowDownCrown,
  write_faster: WriteFasterQuill,
  good_luck: GoodLuckClover,
  bring_it: BringItSwords,
  wake_up: WakeUpClock,
  big_brain: BigBrain,
  gg: GgTrophy,
};

/**
 * Renders the branded SVG for a known emote id. Returns null when the id is
 * unknown so callers can fall back to the server-provided emoji glyph.
 */
export function EmoteIcon({ id, size = 28, ...rest }: { id: string; size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "id">): ReactNode {
  const C = ICON_BY_ID[id];
  if (!C) return null;
  return <C size={size} {...rest} />;
}

export function hasEmoteIcon(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_BY_ID, id);
}
