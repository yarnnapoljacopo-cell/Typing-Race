import { memo } from "react";
import { Type, AlignLeft, Bold, Italic, Underline } from "lucide-react";

export interface WritingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphMode: "none" | "indent" | "double";
  typewriterMode: boolean;
}

const FONTS = [
  { label: "Georgia",  sublabel: "Classic",     value: "Georgia, serif" },
  { label: "Times",    sublabel: "Traditional", value: "'Times New Roman', Times, serif" },
  { label: "Palatino", sublabel: "Elegant",     value: "'Palatino Linotype', Palatino, serif" },
  { label: "Courier",  sublabel: "Typewriter",  value: "'Courier New', Courier, monospace" },
  { label: "System",   sublabel: "Clean",       value: "system-ui, -apple-system, sans-serif" },
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

const PARAGRAPH_MODES: { label: string; sublabel: string; value: WritingStyle["paragraphMode"] }[] = [
  { label: "None",   sublabel: "Plain Enter",           value: "none" },
  { label: "Indent", sublabel: "Indent next paragraph", value: "indent" },
  { label: "Double", sublabel: "Blank line between paragraphs", value: "double" },
];

export type FormatType = "bold" | "italic" | "underline";

interface WritingToolbarProps {
  style: WritingStyle;
  onChange: (style: Partial<WritingStyle>) => void;
  onFormat: (type: FormatType) => void;
}

function ToolBtn({
  active,
  onClick,
  children,
  title,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-7 rounded text-xs font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/60 text-foreground hover:bg-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="h-6 w-px bg-border hidden sm:block" />;

export const WritingToolbar = memo(function WritingToolbar({
  style,
  onChange,
  onFormat,
}: WritingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 bg-card border border-b-0 rounded-t-lg">

      {/* Font family */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <Type size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">Font</span>
      </div>
      <div className="flex items-center gap-1">
        {FONTS.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange({ fontFamily: f.value })}
            title={`${f.label} — ${f.sublabel}`}
            className={`flex flex-col items-center justify-center px-2 py-1 rounded transition-all ${
              style.fontFamily === f.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-foreground hover:bg-muted"
            }`}
            style={{ minWidth: "44px" }}
          >
            <span style={{ fontFamily: f.value, fontSize: "14px", lineHeight: 1, fontWeight: style.fontFamily === f.value ? 700 : 500 }}>
              Ag
            </span>
            <span className="text-[9px] mt-0.5 font-medium leading-none opacity-80">{f.label}</span>
          </button>
        ))}
      </div>

      <Divider />

      {/* Font size */}
      <div className="flex items-center gap-1">
        {SIZES.map((s) => (
          <ToolBtn
            key={s.value}
            active={style.fontSize === s.value}
            onClick={() => onChange({ fontSize: s.value })}
            className="w-8"
          >
            {s.label}
          </ToolBtn>
        ))}
      </div>

      <Divider />

      {/* Line height */}
      <div className="flex items-center gap-1">
        {LINE_HEIGHTS.map((lh) => (
          <ToolBtn
            key={lh.value}
            active={style.lineHeight === lh.value}
            onClick={() => onChange({ lineHeight: lh.value })}
            title={`Line height: ${lh.label}`}
            className="px-2 uppercase tracking-wide text-[10px]"
          >
            {lh.label}
          </ToolBtn>
        ))}
      </div>

      <Divider />

      {/* Paragraph mode */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <AlignLeft size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">¶</span>
      </div>
      <div className="flex items-center gap-1">
        {PARAGRAPH_MODES.map((m) => (
          <ToolBtn
            key={m.value}
            active={style.paragraphMode === m.value}
            onClick={() => onChange({ paragraphMode: m.value })}
            title={m.sublabel}
            className="px-2 uppercase tracking-wide text-[10px]"
          >
            {m.label}
          </ToolBtn>
        ))}
      </div>

      <Divider />

      {/* Formatting: Bold / Italic / Underline */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onFormat("bold")}
          title="Bold"
          className="h-7 w-7 rounded flex items-center justify-center bg-muted/60 text-foreground hover:bg-muted transition-all"
        >
          <Bold size={13} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => onFormat("italic")}
          title="Italic"
          className="h-7 w-7 rounded flex items-center justify-center bg-muted/60 text-foreground hover:bg-muted transition-all"
        >
          <Italic size={13} strokeWidth={2} />
        </button>
        <button
          onClick={() => onFormat("underline")}
          title="Underline"
          className="h-7 w-7 rounded flex items-center justify-center bg-muted/60 text-foreground hover:bg-muted transition-all"
        >
          <Underline size={13} strokeWidth={2} />
        </button>
      </div>

      <Divider />

      {/* Typewriter mode */}
      <ToolBtn
        active={style.typewriterMode}
        onClick={() => onChange({ typewriterMode: !style.typewriterMode })}
        title="Typewriter mode — cursor stays vertically centered while you write"
        className="px-2 text-[10px] uppercase tracking-wide"
      >
        TW
      </ToolBtn>

    </div>
  );
});
