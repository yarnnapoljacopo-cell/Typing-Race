import type { ReactNode, SVGProps } from "react";

// Crest icons sit inside the rotated gold diamond on the guild header. The
// diamond background is light gold, so crests use a dark ink stroke/fill for
// contrast. Each is drawn in a 32x32 viewBox.
const INK = "#1a1208";

type IconProps = { size?: number; color?: string } & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "color">;

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 32 32",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
});

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

function CrestSwords({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5 5l16 16M27 5L11 21" {...stroke(color)} />
      <path d="M4 4l3 3-2 2-3-3z" {...stroke(color)} fill={color} fillOpacity="0.25" />
      <path d="M28 4l-3 3 2 2 3-3z" {...stroke(color)} fill={color} fillOpacity="0.25" />
      <path d="M21 21l5 5M11 21l-5 5" {...stroke(color)} />
      <circle cx="16" cy="16" r="1.6" fill={color} />
    </svg>
  );
}

function CrestTower({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6 4v3h3V4h2v3h3V4h2v3h3V4h2v3h3V4M6 7h20v3l-2 2v14H8V12L6 10z" {...stroke(color)} />
      <rect x="14" y="18" width="4" height="9" {...stroke(color)} />
      <circle cx="12" cy="14" r="1" fill={color} />
      <circle cx="20" cy="14" r="1" fill={color} />
    </svg>
  );
}

function CrestRaven({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M8 22c-3-1-5-4-4-7 1-3 4-4 6-3l3-2c2-2 6-2 8 0 2 1 4 3 4 6 0 4-3 7-7 8H10c-1 0-2-1-2-2z" {...stroke(color)} fill={color} fillOpacity="0.3" />
      <circle cx="22" cy="11" r="0.9" fill={color} />
      <path d="M25 12l3-1-2 2" {...stroke(color)} />
      <path d="M14 18l-2 6M18 18l1 6M22 18l3 5" {...stroke(color)} strokeWidth="1.4" />
    </svg>
  );
}

function CrestQuill({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M26 5C16 5 8 13 8 23c4 0 7-1 9-3" {...stroke(color)} fill={color} fillOpacity="0.18" />
      <path d="M16 14L26 5" {...stroke(color)} />
      <path d="M5 27l7-7" {...stroke(color)} />
      <circle cx="26" cy="5" r="1.4" fill={color} />
      <path d="M14 22h8" {...stroke(color)} strokeWidth="1.4" />
    </svg>
  );
}

function CrestAnchor({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="16" cy="6" r="2.5" {...stroke(color)} />
      <path d="M16 9v18" {...stroke(color)} />
      <path d="M11 14h10" {...stroke(color)} />
      <path d="M5 19c0 5 5 9 11 9s11-4 11-9" {...stroke(color)} />
      <path d="M5 19l-2-2M5 19l3 1M27 19l2-2M27 19l-3 1" {...stroke(color)} strokeWidth="1.4" />
    </svg>
  );
}

function CrestFlame({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M16 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 1-4-2 1-3 3-3 6a8 8 0 0 0 16 0c0-7-7-8-9-13z" {...stroke(color)} fill={color} fillOpacity="0.3" />
      <path d="M8 26h16M10 29h12" {...stroke(color)} />
      <path d="M16 16v4" {...stroke(color)} strokeWidth="1.4" />
    </svg>
  );
}

function CrestMoon({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M22 18a10 10 0 1 1-9-13 7.5 7.5 0 0 0 9 13z" {...stroke(color)} fill={color} fillOpacity="0.22" />
      <path d="M24 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={color} {...stroke(color)} strokeWidth="0.9" />
      <path d="M28 14l0.7 1.3 1.3 0.7-1.3 0.7-0.7 1.3-0.7-1.3-1.3-0.7 1.3-0.7z" fill={color} stroke={color} strokeWidth="0.7" />
    </svg>
  );
}

function CrestEye({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M16 3l13 24H3z" {...stroke(color)} fill={color} fillOpacity="0.12" />
      <path d="M9 20c2-3 5-4 7-4s5 1 7 4c-2 3-5 4-7 4s-5-1-7-4z" {...stroke(color)} fill="#fff" fillOpacity="0.5" />
      <circle cx="16" cy="20" r="2.2" fill={color} />
      <circle cx="16.7" cy="19.3" r="0.6" fill="#fff" />
    </svg>
  );
}

function CrestWolf({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M5 9l3-4 3 5h10l3-5 3 4-2 5 1 6c0 4-5 8-10 8s-10-4-10-8l1-6z" {...stroke(color)} fill={color} fillOpacity="0.22" />
      <path d="M11 16l1 2M21 16l-1 2" {...stroke(color)} strokeWidth="1.4" />
      <circle cx="12" cy="16" r="1" fill={color} />
      <circle cx="20" cy="16" r="1" fill={color} />
      <path d="M14 22l2 2 2-2" {...stroke(color)} strokeWidth="1.4" />
    </svg>
  );
}

function CrestShield({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M16 3l11 3v9c0 7-5 12-11 14-6-2-11-7-11-14V6z" {...stroke(color)} fill={color} fillOpacity="0.18" />
      <path d="M16 9v15M9 15h14" {...stroke(color)} strokeWidth="2" />
      <circle cx="16" cy="15" r="2" fill={color} />
    </svg>
  );
}

function CrestRose({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="16" cy="13" r="6" {...stroke(color)} fill={color} fillOpacity="0.22" />
      <circle cx="16" cy="13" r="3.5" {...stroke(color)} />
      <circle cx="16" cy="13" r="1.4" fill={color} />
      <path d="M16 19v9" {...stroke(color)} />
      <path d="M16 23c-3-1-5 0-6 2M16 26c3-1 5 0 6 2" {...stroke(color)} strokeWidth="1.4" fill={color} fillOpacity="0.2" />
    </svg>
  );
}

function CrestMountain({ size = 22, color = INK, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M3 26l8-14 5 8 4-6 9 12z" {...stroke(color)} fill={color} fillOpacity="0.22" />
      <path d="M9 17l2 2 2-3M18 16l1 1 2-2" {...stroke(color)} strokeWidth="1.2" fill="#fff" fillOpacity="0.7" />
      <circle cx="24" cy="9" r="2" {...stroke(color)} fill={color} fillOpacity="0.5" />
    </svg>
  );
}

const CREST_BY_ID: Record<string, (p: IconProps) => ReactNode> = {
  swords: CrestSwords,
  tower: CrestTower,
  raven: CrestRaven,
  quill: CrestQuill,
  anchor: CrestAnchor,
  flame: CrestFlame,
  moon: CrestMoon,
  eye: CrestEye,
  wolf: CrestWolf,
  shield: CrestShield,
  rose: CrestRose,
  mountain: CrestMountain,
};

export const GUILD_CRESTS: { id: string; label: string }[] = [
  { id: "swords",   label: "Crossed Swords" },
  { id: "tower",    label: "Tower" },
  { id: "raven",    label: "Raven" },
  { id: "quill",    label: "Quill" },
  { id: "anchor",   label: "Anchor" },
  { id: "flame",    label: "Eternal Flame" },
  { id: "moon",     label: "Moon & Star" },
  { id: "eye",      label: "All-Seeing" },
  { id: "wolf",     label: "Wolf" },
  { id: "shield",   label: "Shield" },
  { id: "rose",     label: "Rose" },
  { id: "mountain", label: "Mountain" },
];

/**
 * Renders the SVG for a known crest id. Falls back to swords when the id is
 * unknown so the header always renders something on stale clients.
 */
export function GuildCrest({ id, size = 22, color = INK, ...rest }: { id: string; size?: number; color?: string } & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "id" | "color">): ReactNode {
  const C = CREST_BY_ID[id] ?? CREST_BY_ID.swords;
  return <C size={size} color={color} {...rest} />;
}
