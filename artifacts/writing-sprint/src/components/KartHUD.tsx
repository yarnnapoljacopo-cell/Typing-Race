import { useState, useEffect, useRef } from "react";
import { ITEMS, ITEM_KEYS, TIER_STYLES, type ItemKey } from "@/lib/kartItems";
import type { KartHitNotification } from "@/hooks/useSprintRoom";

interface KartHUDProps {
  items: string[];
  kartBonusWords: number;
  blurCounter: boolean;
  boldText: boolean;
  starActive: boolean;
  onUseItem: (item: string) => void;
  flashEvent: KartFlashEvent | null;
  hitNotification: KartHitNotification | null;
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
  hitNotification,
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
      {/* local style block — sheen, pulse, holo rotation */}
      <style>{`
        @keyframes kartSlotSheen {
          0%   { transform: translateX(-120%) skewX(-18deg); }
          100% { transform: translateX(220%)  skewX(-18deg); }
        }
        @keyframes kartLegendaryRotate {
          to { transform: rotate(360deg); }
        }
        @keyframes kartItemPop {
          0%   { transform: scale(0.6) rotate(-12deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes kartIconBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }
      `}</style>

      {/* Active effects bar */}
      {(blurCounter || boldText || starActive) && (
        <div className="flex items-center gap-2 mb-2">
          {blurCounter && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              Counter blurred
            </span>
          )}
          {boldText && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 animate-pulse">
              Bold text!
            </span>
          )}
          {starActive && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 animate-pulse">
              Invincible!
            </span>
          )}
        </div>
      )}

      {/* Golden Pen bonus */}
      {kartBonusWords > 0 && (
        <div className="text-[10px] font-bold text-yellow-300 mb-2 flex items-center gap-1">
          +{kartBonusWords} bonus words earned
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
        <div className="flex gap-2">
          {[0, 1, 2].map((slot) => {
            const itemKey = items[slot] as ItemKey | undefined;
            const def = itemKey ? ITEMS[itemKey] : null;
            const tier = def ? TIER_STYLES[def.tier] : null;
            const isLegendary = def?.tier === "legendary";

            return (
              <div key={slot} className="relative group">
                {/* Legendary rotating halo (sits behind the slot) */}
                {isLegendary && (
                  <div
                    aria-hidden
                    className="absolute -inset-1 rounded-xl pointer-events-none"
                    style={{
                      background:
                        "conic-gradient(from 0deg, #fde047, #f59e0b, #fde047, #fffbe6, #fde047)",
                      filter: "blur(3px)",
                      opacity: 0.85,
                      animation: "kartLegendaryRotate 4s linear infinite",
                      zIndex: 0,
                    }}
                  />
                )}

                <button
                  onClick={() => def && onUseItem(itemKey!)}
                  onMouseEnter={() => def && setHovered(itemKey!)}
                  onMouseLeave={() => setHovered(null)}
                  disabled={!def}
                  className={`relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden transition-transform duration-150 ${
                    def
                      ? "cursor-pointer hover:scale-110 hover:-translate-y-0.5 active:scale-95"
                      : "cursor-default"
                  }`}
                  style={
                    def && tier
                      ? {
                          background: `linear-gradient(155deg, ${def.gradient[1]} 0%, ${def.gradient[0]} 100%)`,
                          border: `1.5px solid ${tier.ring}`,
                          boxShadow: tier.glow,
                          zIndex: 1,
                        }
                      : {
                          background:
                            "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 6px, rgba(255,255,255,0.06) 6px 12px)",
                          border: "1.5px dashed rgba(255,255,255,0.18)",
                          boxShadow: "inset 0 0 6px rgba(0,0,0,0.4)",
                          zIndex: 1,
                        }
                  }
                  title={def ? `${def.label}: ${def.desc}` : "Empty slot"}
                >
                  {def ? (
                    <>
                      {/* inner radial highlight */}
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 55%)",
                        }}
                      />

                      {/* icon */}
                      <span
                        className="relative"
                        style={{ animation: "kartItemPop 260ms ease-out, kartIconBob 2.4s ease-in-out infinite 260ms" }}
                      >
                        <def.Icon size={30} />
                      </span>

                      {/* tier badge dot (top-right) */}
                      <span
                        aria-hidden
                        className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                        style={{ background: tier!.ring, boxShadow: `0 0 4px ${tier!.ring}` }}
                      />

                      {/* sheen sweep on hover */}
                      <span
                        aria-hidden
                        className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none opacity-0 group-hover:opacity-100"
                      >
                        <span
                          className="absolute top-0 bottom-0 w-1/2"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
                            animation: "kartSlotSheen 700ms ease-out",
                          }}
                        />
                      </span>
                    </>
                  ) : (
                    <span className="text-white/25 text-[9px] font-semibold uppercase tracking-wider">
                      empty
                    </span>
                  )}
                </button>

                {/* Item tooltip */}
                {hovered === itemKey && def && tier && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-52 rounded-lg p-2.5 text-[11px] shadow-2xl pointer-events-none"
                    style={{
                      background: "linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 100%)",
                      border: `1px solid ${def.color}80`,
                      boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 12px ${def.color}40`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 font-bold" style={{ color: def.color }}>
                        <def.Icon size={16} />
                        <span>{def.label}</span>
                      </div>
                      <span
                        className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          color: tier.badgeColor,
                          background: `${tier.ring}26`,
                          border: `1px solid ${tier.ring}`,
                        }}
                      >
                        {tier.badge}
                      </span>
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
            width: "min(440px, calc(100vw - 32px))",
            background: "#0f0f1a",
            border: "1px solid rgba(139,92,246,0.4)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.12)" }}
          >
            <span className="text-sm font-bold text-white/90 uppercase tracking-wide">Kart Mode Items</span>
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
          <div className="px-3 pb-3 pt-2 grid grid-cols-1 gap-1.5 overflow-y-auto" style={{ maxHeight: "300px" }}>
            {ITEM_KEYS.map((key) => {
              const def = ITEMS[key];
              const tier = TIER_STYLES[def.tier];
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-transform hover:translate-x-0.5"
                  style={{
                    background: `linear-gradient(95deg, ${def.gradient[0]}40 0%, ${def.gradient[1]}18 100%)`,
                    border: `1px solid ${def.color}40`,
                  }}
                >
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: `linear-gradient(155deg, ${def.gradient[1]} 0%, ${def.gradient[0]} 100%)`,
                      border: `1.5px solid ${tier.ring}`,
                      boxShadow: tier.glow,
                    }}
                  >
                    <def.Icon size={26} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[12px] font-bold leading-tight" style={{ color: def.color }}>
                        {def.label}
                      </div>
                      <span
                        className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          color: tier.badgeColor,
                          background: `${tier.ring}26`,
                          border: `1px solid ${tier.ring}`,
                        }}
                      >
                        {tier.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/65 leading-relaxed mt-0.5">{def.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal hit notification — below items, full-width loud alert */}
      {hitNotification && (
        <div
          className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3 font-bold animate-in slide-in-from-bottom-2 duration-200"
          style={{
            background: "rgba(239,68,68,0.18)",
            border: "2px solid rgba(239,68,68,0.75)",
            color: "#fca5a5",
            boxShadow: "0 0 24px rgba(239,68,68,0.35), inset 0 0 16px rgba(239,68,68,0.08)",
            animation: "hitPulse 0.5s ease-out",
          }}
        >
          <span className="text-3xl shrink-0">{hitNotification.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-base font-black tracking-wide text-red-400 uppercase">You were hit!</div>
            <div className="text-sm text-red-300/80 font-semibold mt-0.5">
              by <span className="text-red-200 font-black">{hitNotification.sourceName}</span>
            </div>
          </div>
          <span className="text-2xl shrink-0 animate-bounce">💥</span>
        </div>
      )}

      {/* Flash event toast — broadcast to all (only shown when not personally hit) */}
      {flashEvent && !hitNotification && (
        <div
          className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-xl animate-in slide-in-from-bottom-2 duration-300"
          style={{ background: `${flashEvent.color}22`, border: `1px solid ${flashEvent.color}60`, color: "#fff" }}
        >
          <span className="text-lg">{flashEvent.emoji}</span>
          <span>{flashEvent.message}</span>
        </div>
      )}
    </div>
  );
}
