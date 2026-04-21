import { memo } from "react";
import { Type } from "lucide-react";

export interface WritingStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

interface FontOption {
  label: string;
  sublabel: string;
  value: string;
  preview: string;
}

interface SizeOption {
  label: string;
  value: number;
}

const FONTS: FontOption[] = [
  { label: "Georgia",     sublabel: "Classic",     value: "Georgia, serif",                        preview: "Ag" },
  { label: "Times",       sublabel: "Traditional", value: "'Times New Roman', Times, serif",        preview: "Ag" },
  { label: "Palatino",    sublabel: "Elegant",     value: "'Palatino Linotype', Palatino, serif",  preview: "Ag" },
  { label: "Courier",     sublabel: "Typewriter",  value: "'Courier New', Courier, monospace",     preview: "Ag" },
  { label: "System",      sublabel: "Clean",       value: "system-ui, -apple-system, sans-serif", preview: "Ag" },
];

const SIZES: SizeOption[] = [
  { label: "S",  value: 15 },
  { label: "M",  value: 18 },
  { label: "L",  value: 21 },
  { label: "XL", value: 26 },
];

const LINE_HEIGHTS: { label: string; value: number }[] = [
  { label: "Tight",   value: 1.4 },
  { label: "Normal",  value: 1.75 },
  { label: "Relaxed", value: 2.1 },
];

interface WritingToolbarProps {
  style: WritingStyle;
  onChange: (style: Partial<WritingStyle>) => void;
  disabled?: boolean;
}

export const WritingToolbar = memo(function WritingToolbar({
  style,
  onChange,
  disabled,
}: WritingToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-3 py-2 bg-card border border-b-0 rounded-t-lg"
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}
    >
      {/* Font icon label */}
      <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
        <Type size={13} />
        <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Font</span>
      </div>

      {/* Font family options */}
      <div className="flex items-center gap-1.5">
        {FONTS.map((f) => {
          const active = style.fontFamily === f.value;
          return (
            <button
              key={f.value}
              onClick={() => onChange({ fontFamily: f.value })}
              title={`${f.label} — ${f.sublabel}`}
              className={`
                flex flex-col items-center justify-center px-2 py-1 rounded text-center transition-all
                ${active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-foreground hover:bg-muted"
                }
              `}
              style={{ minWidth: "48px" }}
            >
              <span
                style={{ fontFamily: f.value, fontSize: "15px", lineHeight: 1, fontWeight: active ? 700 : 500 }}
              >
                {f.preview}
              </span>
              <span className="text-[9px] mt-0.5 font-medium tracking-wide leading-none opacity-80">
                {f.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Font size */}
      <div className="flex items-center gap-1">
        {SIZES.map((s) => {
          const active = style.fontSize === s.value;
          return (
            <button
              key={s.value}
              onClick={() => onChange({ fontSize: s.value })}
              className={`
                w-8 h-7 rounded text-center text-xs font-bold transition-all
                ${active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-foreground hover:bg-muted"
                }
              `}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border hidden sm:block" />

      {/* Line height */}
      <div className="flex items-center gap-1">
        {LINE_HEIGHTS.map((lh) => {
          const active = style.lineHeight === lh.value;
          return (
            <button
              key={lh.value}
              onClick={() => onChange({ lineHeight: lh.value })}
              title={`Line height: ${lh.label}`}
              className={`
                px-2 h-7 rounded text-[10px] font-semibold tracking-wide uppercase transition-all
                ${active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-foreground hover:bg-muted"
                }
              `}
            >
              {lh.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});
