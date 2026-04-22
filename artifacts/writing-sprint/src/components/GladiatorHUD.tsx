import { useEffect, useRef, useState } from "react";
import type { GladiatorState } from "@/hooks/useSprintRoom";

const BUFF_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  frenzy_heal: { label: "Frenzy", emoji: "⚡", color: "#f59e0b" },
  wound: { label: "Wounded", emoji: "🩸", color: "#ef4444" },
  last_stand: { label: "Last Stand", emoji: "🔥", color: "#f97316" },
  momentum: { label: "Momentum", emoji: "💨", color: "#22c55e" },
};

export interface GladiatorHUDProps {
  state: GladiatorState;
  deathGap: number;
  myName: string;
  opponentName: string | null;
  isRunning: boolean;
}

function GladiatorSVG({ facingRight, isLastStand, isWounded, isAbsent }: {
  facingRight: boolean;
  isLastStand?: boolean;
  isWounded?: boolean;
  isAbsent?: boolean;
}) {
  const opacity = isAbsent ? 0.18 : 1;
  const bodyColor = isLastStand ? "#b91c1c" : isWounded ? "#7c2d2d" : "#1c1c1c";
  const armorColor = isLastStand ? "#450a0a" : "#374151";
  const shieldColor = isAbsent ? "#374151" : "#7c3aed";
  const swordColor = isAbsent ? "#374151" : "#9ca3af";
  const plumeColor = isLastStand ? "#ef4444" : "#dc2626";

  return (
    <svg
      viewBox="0 0 80 155"
      style={{
        width: "100%",
        height: "100%",
        opacity,
        transform: facingRight ? undefined : "scaleX(-1)",
        filter: isLastStand ? "drop-shadow(0 0 8px rgba(239,68,68,0.7))" : undefined,
        transition: "filter 0.5s ease, opacity 0.6s ease",
      }}
      aria-hidden
    >
      {/* Helmet plume */}
      <path d="M 24 18 Q 18 4 26 6 Q 30 1 36 9" fill={plumeColor} />

      {/* Head / Helmet */}
      <path d="M 24 18 Q 24 6 38 6 Q 52 6 52 18 L 52 30 Q 52 34 38 35 Q 24 34 24 30 Z" fill={bodyColor} />
      {/* Visor slit */}
      <rect x="28" y="21" width="20" height="5" rx="2" fill={armorColor} opacity="0.9" />
      {/* Cheek guards */}
      <path d="M 24 22 L 18 28 L 20 34 L 26 30 Z" fill={bodyColor} />
      <path d="M 52 22 L 58 28 L 56 34 L 50 30 Z" fill={bodyColor} />

      {/* Neck */}
      <rect x="34" y="34" width="8" height="7" rx="1" fill={bodyColor} />

      {/* Left pauldron (shield side) */}
      <ellipse cx="20" cy="42" rx="9" ry="5" fill={bodyColor} transform="rotate(-15 20 42)" />
      {/* Right pauldron (sword side) */}
      <ellipse cx="56" cy="42" rx="9" ry="5" fill={bodyColor} transform="rotate(15 56 42)" />

      {/* Chest plate */}
      <path d="M 20 40 L 56 40 L 54 65 L 22 65 Z" fill={bodyColor} />
      {/* Chest line */}
      <line x1="38" y1="42" x2="38" y2="63" stroke={armorColor} strokeWidth="1.5" />

      {/* Belt */}
      <rect x="22" y="62" width="32" height="5" rx="1" fill={armorColor} />

      {/* Shield arm */}
      <path d="M 20 44 L 6 58 L 4 70 L 10 72 L 14 62 L 22 50 Z" fill={bodyColor} />
      {/* Shield */}
      <ellipse cx="5" cy="73" rx="10" ry="14" fill={shieldColor} transform="rotate(-12 5 73)" opacity="0.85" />
      <ellipse cx="5" cy="73" rx="7" ry="10" fill="none" stroke="#4c1d95" strokeWidth="1.5"
        transform="rotate(-12 5 73)" opacity={isAbsent ? 0 : 0.6} />
      {/* Shield boss (center stud) */}
      <circle cx="5" cy="73" r="2" fill="#6d28d9" opacity={isAbsent ? 0 : 0.8} />

      {/* Sword arm (raised) */}
      <path d="M 56 44 L 68 30 L 72 34 L 62 50 Z" fill={bodyColor} />
      {/* Sword blade */}
      <path d="M 68 30 L 77 10 L 80 12 L 72 33 Z" fill={swordColor} />
      {/* Crossguard */}
      <rect x="63" y="26" width="14" height="3" rx="1.5" fill="#6b7280"
        transform="rotate(-42 70 27.5)" />
      {/* Sword grip */}
      <rect x="69" y="28" width="4" height="8" rx="1" fill="#4b5563"
        transform="rotate(-42 71 32)" />

      {/* Pteruges (hip skirt strips) */}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 22 + i * 6.5;
        return (
          <path
            key={i}
            d={`M ${x} 67 L ${x - 2} 85 L ${x + 4} 83 L ${x + 6} 67 Z`}
            fill={bodyColor}
            opacity={0.85 + i * 0.02}
          />
        );
      })}

      {/* Left leg (forward) */}
      <path d="M 28 83 L 22 112 L 18 148 L 28 148 L 32 116 L 38 85 Z" fill={bodyColor} />
      {/* Left greave */}
      <rect x="17" y="113" width="13" height="34" rx="3" fill={armorColor} />

      {/* Right leg (back, slightly raised) */}
      <path d="M 42 83 L 52 112 L 56 148 L 66 148 L 62 116 L 52 85 Z" fill={bodyColor} />
      {/* Right greave */}
      <rect x="52" y="113" width="13" height="34" rx="3" fill={armorColor} />

      {/* Left foot */}
      <ellipse cx="24" cy="150" rx="10" ry="4" fill={bodyColor} />
      {/* Right foot */}
      <ellipse cx="59" cy="150" rx="10" ry="4" fill={bodyColor} />

      {/* Last stand glow eyes */}
      {isLastStand && !isAbsent && (
        <>
          <circle cx="32" cy="23" r="2.5" fill="#ef4444" opacity="0.9" />
          <circle cx="43" cy="23" r="2.5" fill="#ef4444" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

function HpBar({ hp, facingRight, isLow, isMid }: {
  hp: number; facingRight: boolean; isLow: boolean; isMid: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / 1000) * 100));
  const barColor = isLow
    ? "linear-gradient(90deg, #991b1b, #ef4444)"
    : isMid
    ? "linear-gradient(90deg, #92400e, #f97316)"
    : "linear-gradient(90deg, #14532d, #22c55e)";

  return (
    <div className="w-full space-y-0.5">
      {/* HP label + number */}
      <div
        className="flex justify-between items-baseline text-xs font-bold"
        style={{ flexDirection: facingRight ? "row" : "row-reverse" }}
      >
        <span
          className={`font-mono tabular-nums text-sm ${isLow ? "text-red-400 animate-pulse" : isMid ? "text-orange-400" : "text-green-400"}`}
        >
          {Math.round(hp)}
        </span>
        <span className="text-white/40 text-[10px]">HP</span>
      </div>
      {/* Bar track */}
      <div
        className="relative h-5 rounded overflow-hidden w-full"
        style={{
          background: "rgba(0,0,0,0.5)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          direction: facingRight ? "ltr" : "rtl",
        }}
      >
        <div
          className="h-full rounded transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: barColor,
            boxShadow: isLow ? "0 0 10px rgba(239,68,68,0.5)" : undefined,
          }}
        />
        {/* Quarter marks */}
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute top-0 h-full w-px bg-black/40"
            style={{ left: `${m}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function BuffPips({ buffs, align }: { buffs: string[]; align: "left" | "right" }) {
  const visible = buffs.filter((b) => BUFF_LABELS[b]);
  if (!visible.length) return <div className="h-5" />;
  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      style={{ justifyContent: align === "left" ? "flex-start" : "flex-end" }}
    >
      {visible.map((b) => {
        const def = BUFF_LABELS[b];
        return (
          <span
            key={b}
            className="text-[9px] font-bold px-1 py-0.5 rounded"
            style={{ background: `${def.color}25`, color: def.color, border: `1px solid ${def.color}45` }}
            title={def.label}
          >
            {def.emoji} {def.label}
          </span>
        );
      })}
    </div>
  );
}

function ArenaCrowd({ excitement }: { excitement: "calm" | "stirring" | "excited" | "frenzied" | "erupting" }) {
  const crowdRef = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (excitement === "calm") return;
    const speed = excitement === "erupting" ? 80 : excitement === "frenzied" ? 120 : excitement === "excited" ? 200 : 400;
    const id = setInterval(() => setTick((t) => t + 1), speed);
    return () => clearInterval(id);
  }, [excitement]);

  const count = 44;
  const backCount = 32;

  return (
    <div
      className="w-full overflow-hidden relative"
      style={{ height: "56px", background: "rgba(0,0,0,0.4)" }}
      aria-hidden
    >
      {/* back row */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-2">
        {Array.from({ length: backCount }).map((_, i) => {
          const amp = excitement === "erupting" ? 10 : excitement === "frenzied" ? 7 : excitement === "excited" ? 4 : 1;
          const dy = amp > 1 ? Math.sin(i * 1.5 + tick * 0.4) * amp : 0;
          return (
            <div
              key={i}
              style={{
                width: 5, height: 14 + (i % 3) * 3,
                background: "rgba(255,255,255,0.10)",
                borderRadius: "3px 3px 0 0",
                transform: `translateY(${dy}px)`,
                transition: "transform 0.15s ease",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
      {/* front row with arms */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-1">
        {Array.from({ length: count }).map((_, i) => {
          const amp = excitement === "erupting" ? 14 : excitement === "frenzied" ? 10 : excitement === "excited" ? 5 : excitement === "stirring" ? 2 : 0;
          const phase = i * 0.9 + tick * 0.5;
          const dy = amp > 0 ? Math.sin(phase) * amp : 0;
          const armUp = amp > 4 && Math.sin(phase + 0.5) > 0.3;
          const h = 18 + (i % 5) * 2;
          return (
            <div key={i} style={{ position: "relative", flexShrink: 0, transform: `translateY(${dy}px)`, transition: "transform 0.12s ease" }}>
              {/* raised arm */}
              {armUp && (
                <div style={{
                  position: "absolute", bottom: h - 2, left: "50%", transform: "translateX(-50%)",
                  width: 2, height: 8, background: "rgba(255,255,255,0.28)", borderRadius: 2,
                }} />
              )}
              {/* body */}
              <div style={{
                width: 6, height: h,
                background: "rgba(255,255,255,0.22)",
                borderRadius: "3px 3px 0 0",
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WaitingSlot({ name, isMe }: { name: string; isMe: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ opacity: 0.45 }}>
      <div className="text-xs text-white/40 font-medium animate-pulse">
        {isMe ? "" : "Waiting for challenger…"}
      </div>
      {/* Ghost silhouette */}
      <div style={{ width: 70, height: 116, position: "relative" }}>
        <GladiatorSVG facingRight={!isMe} isAbsent />
      </div>
      <div className="text-xs text-white/25 font-mono">???</div>
    </div>
  );
}

function GladiatorSlot({
  name,
  hp,
  wordCount,
  buffs,
  facingRight,
  isRunning,
}: {
  name: string;
  hp: number;
  wordCount: number;
  buffs: string[];
  facingRight: boolean;
  isRunning: boolean;
}) {
  const isLow = hp < 200;
  const isMid = hp < 500;
  const isLastStand = hp < 200;
  const isWounded = buffs.includes("wound");

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0, flex: 1 }}>
      {/* HP bar */}
      <div className="w-full px-1">
        <HpBar hp={hp} facingRight={facingRight} isLow={isLow} isMid={isMid} />
      </div>

      {/* Buffs */}
      <div className="w-full px-1">
        <BuffPips buffs={buffs} align={facingRight ? "left" : "right"} />
      </div>

      {/* Name */}
      <div
        className="text-xs font-bold truncate max-w-full px-2 py-0.5 rounded"
        style={{
          color: facingRight ? "#a78bfa" : "#f87171",
          background: facingRight ? "rgba(139,92,246,0.12)" : "rgba(248,113,113,0.12)",
          border: `1px solid ${facingRight ? "rgba(139,92,246,0.25)" : "rgba(248,113,113,0.25)"}`,
        }}
        title={name}
      >
        {name}
      </div>

      {/* Gladiator figure */}
      <div
        style={{
          width: 80,
          height: 124,
          position: "relative",
          animation: isLastStand ? "lastStandShake 0.18s infinite" : undefined,
        }}
      >
        <GladiatorSVG
          facingRight={facingRight}
          isLastStand={isLastStand}
          isWounded={isWounded}
        />
      </div>

      {/* Word count */}
      {isRunning && (
        <div className="text-[11px] font-mono font-bold text-white/60 tabular-nums">
          {wordCount} <span className="text-white/30 font-normal">words</span>
        </div>
      )}
    </div>
  );
}

export function GladiatorHUD({ state, deathGap, myName, opponentName, isRunning }: GladiatorHUDProps) {
  const { myHp, opponentHp, myWordCount, opponentWordCount, gap, iAhead, myBuffs, opponentBuffs } = state;

  const gapRatio = Math.min(1, gap / deathGap);
  const myLastStand = myHp < 200;
  const opLastStand = opponentHp < 200;

  const excitement =
    (myLastStand || opLastStand) ? "erupting"
    : gapRatio >= 0.75 ? "frenzied"
    : gapRatio >= 0.5 ? "excited"
    : gapRatio >= 0.25 ? "stirring"
    : "calm";

  const hasOpponent = opponentName !== null;

  return (
    <div
      className="w-full rounded-xl overflow-hidden select-none"
      style={{
        background: "linear-gradient(180deg, #0a0603 0%, #150e07 35%, #1e1508 100%)",
        border: "1px solid rgba(255,200,100,0.12)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,200,100,0.08)",
      }}
    >
      {/* Crowd at the top */}
      <ArenaCrowd excitement={excitement} />

      {/* Torch line */}
      <div
        className="w-full flex justify-between px-6 py-1"
        style={{ background: "rgba(0,0,0,0.3)" }}
      >
        <span style={{ fontSize: 14 }}>🔥</span>
        <span className="text-[10px] font-bold tracking-widest text-yellow-600/70 uppercase">
          {isRunning ? "⚔ Combat ⚔" : hasOpponent ? "⚔ Arena ⚔" : "⚔ Awaiting challenger ⚔"}
        </span>
        <span style={{ fontSize: 14 }}>🔥</span>
      </div>

      {/* Main arena floor */}
      <div
        className="relative w-full"
        style={{
          background: "linear-gradient(180deg, #1a1008 0%, #241708 60%, #2e1f0a 100%)",
          padding: "12px 16px 8px",
        }}
      >
        {/* Arena sand texture line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2"
          style={{ background: "linear-gradient(180deg, transparent, rgba(180,140,80,0.12))" }}
        />

        {/* Two gladiator columns */}
        <div className="flex items-end gap-2">
          {/* LEFT: always player */}
          <GladiatorSlot
            name={myName}
            hp={myHp}
            wordCount={myWordCount}
            buffs={myBuffs}
            facingRight={true}
            isRunning={isRunning}
          />

          {/* CENTER divider */}
          <div
            className="flex flex-col items-center gap-1 shrink-0 pb-2"
            style={{ width: 44 }}
          >
            {isRunning && (
              <>
                {/* Gap indicator */}
                <div
                  className="text-[9px] font-bold text-center leading-tight"
                  style={{ color: gapRatio >= 0.75 ? "#ef4444" : gapRatio >= 0.5 ? "#f97316" : "#6b7280" }}
                >
                  {iAhead ? "▲" : "▼"}
                  <br />
                  <span className="tabular-nums">{gap}</span>
                </div>
                {/* VS line with gap fill */}
                <div
                  className="w-px flex-1 mx-auto min-h-4 max-h-16"
                  style={{
                    background: gapRatio >= 0.75
                      ? "linear-gradient(180deg, #ef4444, transparent)"
                      : "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)",
                  }}
                />
              </>
            )}
            <div
              className="text-lg leading-none"
              style={{
                filter: "drop-shadow(0 0 6px rgba(255,200,80,0.5))",
                animation: isRunning && gapRatio >= 0.75 ? "pulse 0.6s infinite" : undefined,
              }}
            >
              ⚔️
            </div>
          </div>

          {/* RIGHT: opponent or waiting */}
          {hasOpponent ? (
            <GladiatorSlot
              name={opponentName!}
              hp={opponentHp}
              wordCount={opponentWordCount}
              buffs={opponentBuffs}
              facingRight={false}
              isRunning={isRunning}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
              {/* Placeholder HP bar */}
              <div className="w-full px-1">
                <div className="h-5 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
              </div>
              <div className="h-5" />
              <div className="text-[10px] text-white/25 font-medium">???</div>
              <div style={{ width: 80, height: 124 }}>
                <GladiatorSVG facingRight={false} isAbsent />
              </div>
              <div className="text-[10px] text-amber-500/50 animate-pulse font-medium text-center leading-tight">
                Waiting for<br />challenger…
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: sand/floor strip */}
      <div
        className="w-full h-3"
        style={{
          background: "linear-gradient(180deg, rgba(180,140,60,0.15), rgba(100,80,40,0.08))",
          borderTop: "1px solid rgba(180,140,60,0.1)",
        }}
      />
    </div>
  );
}
