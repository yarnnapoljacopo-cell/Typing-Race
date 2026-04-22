import { useState } from "react";
import { ITEMS, type ItemKey } from "@/lib/kartItems";

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
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Items</span>
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
                {/* Tooltip */}
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
