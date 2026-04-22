import { useMemo } from "react";
import type { GladiatorState } from "@/hooks/useSprintRoom";

const BUFF_LABELS: Record<string, { label: string; emoji: string; color: string; isDebuff?: boolean }> = {
  frenzy_heal: { label: "Frenzy!", emoji: "⚡", color: "#f59e0b" },
  wound: { label: "Wounded", emoji: "🩸", color: "#ef4444", isDebuff: true },
  last_stand: { label: "Last Stand", emoji: "🔥", color: "#f97316" },
  momentum: { label: "Momentum", emoji: "💨", color: "#22c55e" },
};

interface GladiatorHUDProps {
  state: GladiatorState;
  deathGap: number;
}

function HPBar({ hp, max = 1000, label }: { hp: number; max?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const isLow = hp < 200;
  const isMid = hp < 500;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</span>
        <span className={`text-sm font-mono font-bold tabular-nums ${isLow ? "text-red-400 animate-pulse" : isMid ? "text-orange-400" : "text-green-400"}`}>
          {Math.round(hp)} <span className="text-[10px] text-white/30">/ {max}</span>
        </span>
      </div>
      <div
        className="relative h-4 rounded overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: isLow
              ? "linear-gradient(90deg, #991b1b, #ef4444)"
              : isMid
              ? "linear-gradient(90deg, #92400e, #f97316)"
              : "linear-gradient(90deg, #14532d, #22c55e)",
            boxShadow: isLow ? "0 0 12px rgba(239,68,68,0.6)" : undefined,
          }}
        />
        {/* Medieval HP bar notches */}
        {[25, 50, 75].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 h-full w-px"
            style={{ left: `${mark}%`, background: "rgba(0,0,0,0.4)" }}
          />
        ))}
      </div>
    </div>
  );
}

function GapMeter({ gap, deathGap, iAhead }: { gap: number; deathGap: number; iAhead: boolean }) {
  const pct = Math.min(100, (gap / deathGap) * 100);
  const isDanger = pct >= 75;
  const isWarning = pct >= 50;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          {iAhead ? "You lead by" : "You trail by"}
        </span>
        <span className={`text-xs font-mono font-bold ${isDanger ? "text-red-400 animate-pulse" : isWarning ? "text-orange-400" : "text-white/70"}`}>
          {gap} <span className="text-[10px] text-white/30">/ {deathGap} ⚔️</span>
        </span>
      </div>
      <div
        className="relative h-3 rounded overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: isDanger
              ? "linear-gradient(90deg, #7f1d1d, #ef4444)"
              : isWarning
              ? "linear-gradient(90deg, #78350f, #f59e0b)"
              : iAhead
              ? "linear-gradient(90deg, #1e3a5f, #3b82f6)"
              : "linear-gradient(90deg, #1c1917, #a8a29e)",
          }}
        />
        {/* Death threshold marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500/80"
          style={{ right: 0, boxShadow: "0 0 6px #ef4444" }}
          title="Execution threshold"
        />
      </div>
    </div>
  );
}

function BuffIcons({ buffs, label }: { buffs: string[]; label: string }) {
  if (buffs.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}:</span>
      {buffs.map((buff) => {
        const def = BUFF_LABELS[buff];
        if (!def) return null;
        return (
          <span
            key={buff}
            className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{
              background: `${def.color}20`,
              borderColor: `${def.color}50`,
              color: def.color,
            }}
            title={def.label}
          >
            {def.emoji} {def.label}
          </span>
        );
      })}
    </div>
  );
}

function CrowdSilhouette({ gapRatio, lastStand }: { gapRatio: number; lastStand: boolean }) {
  const level = lastStand ? "erupting" : gapRatio >= 0.75 ? "agitated" : gapRatio >= 0.5 ? "excited" : gapRatio >= 0.25 ? "stirring" : "calm";

  const figures = 32;
  const figures2 = 24;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ height: "48px", position: "relative", marginTop: "4px" }}
      aria-hidden
    >
      {/* Back row */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-1">
        {Array.from({ length: figures2 }).map((_, i) => {
          const offset = level === "erupting"
            ? Math.sin(Date.now() / 100 + i) * 12
            : level === "agitated"
            ? Math.sin(i * 1.3) * 8
            : level === "excited"
            ? Math.sin(i * 1.7) * 4
            : level === "stirring"
            ? (i % 4 === 0 ? -3 : 0)
            : 0;
          return (
            <div
              key={i}
              className="shrink-0"
              style={{
                width: "6px",
                height: `${18 + (i % 3) * 3}px`,
                background: "rgba(255,255,255,0.12)",
                borderRadius: "3px 3px 0 0",
                transform: `translateY(${offset}px)`,
                transition: "transform 0.3s ease",
              }}
            />
          );
        })}
      </div>
      {/* Front row */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-3">
        {Array.from({ length: figures }).map((_, i) => {
          const armRaise = level === "erupting" ? 1 : level === "agitated" ? 0.7 : level === "excited" ? 0.4 : 0;
          const wave = armRaise > 0 ? Math.sin((i * 0.8) + (Date.now() / 400)) * armRaise * 10 : 0;
          const height = 20 + (i % 4) * 2;
          return (
            <div
              key={i}
              className="shrink-0 relative"
              style={{
                width: "7px",
                height: `${height}px`,
                background: "rgba(255,255,255,0.22)",
                borderRadius: "3px 3px 0 0",
                transform: `translateY(${wave}px)`,
                transition: "transform 0.2s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function GladiatorHUD({ state, deathGap }: GladiatorHUDProps) {
  const { myHp, opponentHp, myWordCount, opponentWordCount, gap, iAhead, myBuffs, opponentBuffs } = state;
  const isLastStand = myHp < 200;
  const gapRatio = Math.min(1, gap / deathGap);

  return (
    <div
      className="w-full rounded-xl overflow-hidden"
      style={{ background: "rgba(10,10,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
    >
      {/* Top section: HP bars */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <HPBar hp={myHp} label="Your HP" />
        <HPBar hp={opponentHp} label="Opponent HP" />
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

      {/* Middle: gap meter + word counts */}
      <div className="px-4 py-3 space-y-2">
        <GapMeter gap={gap} deathGap={deathGap} iAhead={iAhead} />

        <div className="flex justify-between text-xs font-mono">
          <div className="flex items-center gap-1">
            <span className="text-white/40">You</span>
            <span className="font-bold text-white">{myWordCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/40">Opponent</span>
            <span className="font-bold text-white/70">{opponentWordCount}</span>
          </div>
        </div>

        {/* Buffs */}
        <div className="space-y-1">
          <BuffIcons buffs={myBuffs} label="Your buffs" />
          <BuffIcons buffs={opponentBuffs.filter(b => b === "last_stand" || b === "wound")} label="Opponent" />
        </div>
      </div>

      {/* Crowd silhouette */}
      <div
        style={{
          background: isLastStand
            ? "linear-gradient(to bottom, transparent, rgba(239,68,68,0.15))"
            : gapRatio >= 0.75
            ? "linear-gradient(to bottom, transparent, rgba(239,68,68,0.08))"
            : "linear-gradient(to bottom, transparent, rgba(255,255,255,0.03))",
          transition: "background 1s ease",
        }}
      >
        <CrowdSilhouette gapRatio={gapRatio} lastStand={isLastStand} />
      </div>
    </div>
  );
}
