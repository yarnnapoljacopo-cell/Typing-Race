import { memo, useState } from "react";

export interface WritingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphMode: "none" | "indent" | "double";
  typewriterMode: boolean;
}

const C = {
  muted: "#7a7a92",
  ink: "#1a1a2e",
  blue: "#6B8FD4",
  blueLight: "#dce6f7",
  border: "rgba(107,143,212,0.15)",
};

const FONTS = [
  { label: "Georgia",  sublabel: "Georgia",  value: "Georgia, serif" },
  { label: "Times",    sublabel: "Times",    value: "'Times New Roman', Times, serif" },
  { label: "Palatino", sublabel: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
  { label: "Courier",  sublabel: "Courier",  value: "'Courier New', Courier, monospace" },
  { label: "System",   sublabel: "System",   value: "system-ui, -apple-system, sans-serif" },
];

const SIZES = [
  { label: "S",  value: 15 },
  { label: "M",  value: 18 },
  { label: "L",  value: 21 },
  { label: "XL", value: 26 },
];

const LINE_HEIGHTS = [
  { label: "Tight",   value: 1.4 },
  { label: "Normal",  value: 1.75 },
  { label: "Relaxed", value: 2.1 },
];

const PARAGRAPH_MODES: { label: string; value: WritingStyle["paragraphMode"] }[] = [
  { label: "None",   value: "none" },
  { label: "Indent", value: "indent" },
  { label: "Double", value: "double" },
];

export type FormatType = "bold" | "italic" | "underline";

interface WritingToolbarProps {
  style: WritingStyle;
  onChange: (style: Partial<WritingStyle>) => void;
  onFormat: (type: FormatType) => void;
  activeFormats?: { bold: boolean; italic: boolean; underline: boolean };
}

const dividerStyle: React.CSSProperties = {
  width: 1, height: 20,
  background: C.border,
  margin: "0 4px",
  flexShrink: 0,
};

function fontChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "3px 8px", borderRadius: 8, fontSize: "0.82rem",
    cursor: "pointer", border: `1.5px solid ${active ? C.blue : "transparent"}`,
    transition: "all 0.15s", color: active ? "white" : C.muted,
    background: active ? C.blue : "none", fontFamily: "'DM Sans', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    lineHeight: 1.1,
  };
}

function sizeChipStyle(active: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
    border: `1.5px solid transparent`,
    color: active ? "white" : C.muted,
    background: active ? C.blue : "none",
    transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
  };
}

function spacingChipStyle(active: boolean, dark?: boolean): React.CSSProperties {
  const activeBg = dark ? C.ink : C.blue;
  return {
    padding: "3px 8px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
    cursor: "pointer", border: `1.5px solid transparent`,
    color: active ? "white" : C.muted,
    letterSpacing: "0.05em", textTransform: "uppercase",
    transition: "all 0.15s", background: active ? activeBg : "none",
    fontFamily: "'DM Sans', sans-serif",
  };
}

const formatChipBase: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
  border: `1.5px solid ${C.border}`,
  color: C.muted, transition: "all 0.15s", background: "none",
};

function formatChipStyle(active: boolean): React.CSSProperties {
  return {
    ...formatChipBase,
    background: active ? C.blue : "none",
    color: active ? "white" : C.muted,
    border: `1.5px solid ${active ? C.blue : C.border}`,
    boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.25)" : "none",
  };
}

export const WritingToolbar = memo(function WritingToolbar({
  style,
  onChange,
  onFormat,
  activeFormats,
}: WritingToolbarProps) {
  const aBold = activeFormats?.bold ?? false;
  const aItalic = activeFormats?.italic ?? false;
  const aUnderline = activeFormats?.underline ?? false;
  const [showFonts, setShowFonts] = useState(false);

  const currentFont = FONTS.find((f) => f.value === style.fontFamily) ?? FONTS[0];
  const currentSize = SIZES.find((s) => s.value === style.fontSize) ?? SIZES[1];
  const currentLH = LINE_HEIGHTS.find((lh) => lh.value === style.lineHeight) ?? LINE_HEIGHTS[1];

  const swallowButtonMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "BUTTON" || t.closest("button")) e.preventDefault();
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "'DM Sans', sans-serif" }}
      onMouseDown={swallowButtonMouseDown}
    >
      {/* Expanded font panel — drops in above the main row */}
      {showFonts && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {FONTS.map((f) => (
            <button
              key={f.value}
              onClick={() => onChange({ fontFamily: f.value })}
              title={f.label}
              style={fontChipStyle(style.fontFamily === f.value)}
            >
              <span style={{ fontFamily: f.value, fontSize: "0.82rem", fontWeight: 700 }}>Ag</span>
              <small style={{ fontSize: "0.6rem" }}>{f.sublabel}</small>
            </button>
          ))}

          <div style={dividerStyle} />

          {SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => onChange({ fontSize: s.value })}
              style={sizeChipStyle(style.fontSize === s.value)}
            >
              {s.label}
            </button>
          ))}

          <div style={dividerStyle} />

          {LINE_HEIGHTS.map((lh) => (
            <button
              key={lh.value}
              onClick={() => onChange({ lineHeight: lh.value })}
              style={spacingChipStyle(style.lineHeight === lh.value)}
            >
              {lh.label}
            </button>
          ))}
        </div>
      )}

      {/* Always-visible row: font toggle + formatting */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Font toggle pill — shows current font, click to expand */}
        <button
          onClick={() => setShowFonts((v) => !v)}
          title={showFonts ? "Hide font options" : "Change font, size & spacing"}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 8, cursor: "pointer",
            border: `1.5px solid ${showFonts ? C.blue : C.border}`,
            background: showFonts ? C.blueLight : "none",
            color: showFonts ? C.ink : C.muted,
            fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", fontWeight: 700,
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: currentFont.value, fontSize: "0.82rem", fontWeight: 700 }}>Ag</span>
          <span>{currentFont.sublabel}</span>
          <span style={{ fontSize: "0.65rem", color: C.muted, fontWeight: 600 }}>{currentSize.label} · {currentLH.label}</span>
          <span style={{ fontSize: "0.6rem", marginLeft: 1 }}>{showFonts ? "▲" : "▼"}</span>
        </button>

        <div style={dividerStyle} />

        {/* Paragraph mode */}
        <button style={{ ...formatChipBase, fontSize: "0.85rem" }} title="Paragraph settings">≡</button>
        {PARAGRAPH_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange({ paragraphMode: m.value })}
            style={spacingChipStyle(style.paragraphMode === m.value, true)}
          >
            {m.label}
          </button>
        ))}

        <div style={dividerStyle} />

        {/* B / I / U */}
        <button
          onMouseDown={(e) => { e.preventDefault(); onFormat("bold"); }}
          title="Bold"
          aria-pressed={aBold}
          style={formatChipStyle(aBold)}
          onMouseEnter={e => { if (!aBold) { (e.currentTarget as HTMLElement).style.background = C.blueLight; (e.currentTarget as HTMLElement).style.color = C.ink; } }}
          onMouseLeave={e => { if (!aBold) { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.muted; } }}
        >
          <strong>B</strong>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); onFormat("italic"); }}
          title="Italic"
          aria-pressed={aItalic}
          style={formatChipStyle(aItalic)}
          onMouseEnter={e => { if (!aItalic) { (e.currentTarget as HTMLElement).style.background = C.blueLight; (e.currentTarget as HTMLElement).style.color = C.ink; } }}
          onMouseLeave={e => { if (!aItalic) { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.muted; } }}
        >
          <em>I</em>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); onFormat("underline"); }}
          title="Underline"
          aria-pressed={aUnderline}
          style={{ ...formatChipStyle(aUnderline), textDecoration: "underline" }}
          onMouseEnter={e => { if (!aUnderline) { (e.currentTarget as HTMLElement).style.background = C.blueLight; (e.currentTarget as HTMLElement).style.color = C.ink; } }}
          onMouseLeave={e => { if (!aUnderline) { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = C.muted; } }}
        >
          U
        </button>

        <div style={dividerStyle} />

        <button
          onClick={() => onChange({ typewriterMode: !style.typewriterMode })}
          title="Typewriter mode — cursor stays vertically centered while you write"
          style={spacingChipStyle(style.typewriterMode, true)}
        >
          TW
        </button>
      </div>
    </div>
  );
});
