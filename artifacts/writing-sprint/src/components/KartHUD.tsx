import { useState, useEffect, useRef } from "react";
import { ITEMS, ITEM_KEYS, type ItemKey } from "@/lib/kartItems";

interface KartHUDProps {
  items: string[];
  kartBonusWords: number;
  blurCounter: boolean;
  boldText: boolean;
  starActive: boolean;
  onUseItem: (item: string) => void;
  flashEvent: KartFlashEvent | null;
}

export interface KartFlashEvent {
  emoji: string;
  label: string;
  message: string;
  color: string;
}

export function KartHUD({
  items,
  kartBonusWords,
  blurCounter,
  boldText,
  starActive,
  onUseItem,
  flashEvent,
}: KartHUDProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowHelp(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [showHelp]);

  return (
    <div className="relative select-none">
      {/* Active effects bar */}
      {(blurCounter || boldText || starActive) && (
        <div className="flex items-center gap-2 mb-2">
          {blurCounter && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              🔴 Counter blurred
            </span>
          )}
          {boldText && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 animate-pulse">
              🍌 Bold text!
            </span>
          )}
          {starActive && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 animate-pulse">
              ⭐ Invincible!
            </span>
          )}
        </div>
      )}

      {/* Golden Pen bonus */}
      {kartBonusWords > 0 && (
        <div className="text-[10px] font-bold text-yellow-300 mb-2 flex items-center gap-1">
          🌟 +{kartBonusWords} bonus words earned
        </div>
      )}

      {/* Item inventory */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Items</span>
          {/* Help button */}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all duration-150 hover:scale-110"
            style={{
              background: showHelp ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)",
              borderColor: showHelp ? "rgba(139,92,246,0.7)" : "rgba(255,255,255,0.2)",
              color: showHelp ? "#c4b5fd" : "rgba(255,255,255,0.5)",
            }}
            title="What items are there?"
          >
            ?
          </button>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((slot) => {
            const itemKey = items[slot] as ItemKey | undefined;
            const def = itemKey ? ITEMS[itemKey] : null;
            return (
              <div key={slot} className="relative group">
                <button
                  onClick={() => def && onUseItem(itemKey!)}
                  onMouseEnter={() => def && setHovered(itemKey!)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={!def}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg transition-all duration-150 ${
                    def
                      ? "cursor-pointer hover:scale-110 active:scale-95 hover:shadow-lg"
                      : "cursor-default opacity-30"
                  }`}
                  style={def ? {
                    background: def.bgColor,
                    borderColor: def.color,
                    boxShadow: `0 0 8px ${def.color}40`,
                  } : {
                    background: "rgba(255,255,255,0.05)",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                  title={def ? `${def.label}: ${def.desc}` : "Empty slot"}
                >
                  {def ? def.emoji : ""}
                </button>
                {/* Item tooltip */}
                {hovered === itemKey && def && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-48 rounded-lg p-2.5 text-[11px] shadow-xl pointer-events-none"
                    style={{ background: "#1a1a2e", border: `1px solid ${def.color}60` }}
                  >
                    <div className="font-bold mb-0.5" style={{ color: def.color }}>
                      {def.emoji} {def.label}
                    </div>
                    <div className="text-white/70 leading-relaxed">{def.desc}</div>
                    <div className="mt-1 text-white/40 italic">Click to use</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Items guide panel — opens downward so it never clips off the top */}
      {showHelp && (
        <div
          ref={helpRef}
          className="absolute z-50 rounded-xl shadow-2xl overflow-hidden"
          style={{
            top: "calc(100% + 8px)",
            left: 0,
            width: "min(420px, calc(100vw - 32px))",
            background: "#0f0f1a",
            border: "1px solid rgba(139,92,246,0.4)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.12)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🏎️</span>
              <span className="text-sm font-bold text-white/90">Kart Mode Items</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="text-white/40 hover:text-white/80 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* How items work */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] text-white/40 leading-relaxed">
              Earn an item every <strong className="text-white/60">250 words</strong>. Hold up to <strong className="text-white/60">3</strong> items. Lower-ranked writers get rarer items. Click an item slot to use it.
            </p>
          </div>

          {/* Item list */}
          <div className="px-3 pb-3 pt-2 grid grid-cols-1 gap-1">
            {ITEM_KEYS.map((key) => {
              const def = ITEMS[key];
              return (
                <div
                  key={key}
                  className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors"
                  style={{ background: `${def.bgColor}` }}
                >
                  <span className="text-xl shrink-0 mt-0.5">{def.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold leading-tight" style={{ color: def.color }}>
                      {def.label}
                    </div>
                    <div className="text-[10px] text-white/60 leading-relaxed mt-0.5">{def.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flash event toast */}
      {flashEvent && (
        <div
          className="absolute -top-14 left-0 right-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-xl z-50 animate-in slide-in-from-top-2 duration-300"
          style={{ background: `${flashEvent.color}22`, border: `1px solid ${flashEvent.color}60`, color: "#fff" }}
        >
          <span className="text-lg">{flashEvent.emoji}</span>
          <span>{flashEvent.message}</span>
        </div>
      )}
    </div>
  );
}
