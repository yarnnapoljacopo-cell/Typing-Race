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

/* ─── Gladiator SVG figure ──────────────────────────────────── */

function GladiatorSVG({
  facingRight,
  isLastStand,
  isAbsent,
  isSlashing,
}: {
  facingRight: boolean;
  isLastStand?: boolean;
  isAbsent?: boolean;
  isSlashing?: boolean;
}) {
  const bodyColor = isAbsent ? "#2a2a2a" : isLastStand ? "#7f1d1d" : "#111827";
  const armorColor = isAbsent ? "#1f2937" : isLastStand ? "#3b0a0a" : "#1f2937";
  const shieldColor = isAbsent ? "#1f2937" : "#5b21b6";
  const swordColor = isAbsent ? "#374151" : "#d1d5db";
  const plumeColor = isLastStand ? "#dc2626" : "#b91c1c";
  const glowEyes = isLastStand && !isAbsent;

  return (
    <svg
      viewBox="0 0 80 155"
      style={{
        width: "100%",
        height: "100%",
        opacity: isAbsent ? 0.2 : 1,
        transform: facingRight ? undefined : "scaleX(-1)",
        filter: isLastStand && !isAbsent
          ? "drop-shadow(0 0 10px rgba(220,38,38,0.8))"
          : undefined,
        transition: "filter 0.5s ease, opacity 0.5s ease",
        animation: isSlashing
          ? `${facingRight ? "slashRight" : "slashLeft"} 0.35s ease-out`
          : undefined,
      }}
      aria-hidden
    >
      {/* Helmet plume */}
      <path d="M 26 17 Q 20 3 28 6 Q 32 0 38 8" fill={plumeColor} />

      {/* Helmet */}
      <path
        d="M 24 18 Q 24 6 38 6 Q 52 6 52 18 L 52 30 Q 52 34 38 35 Q 24 34 24 30 Z"
        fill={bodyColor}
      />
      {/* Visor */}
      <rect x="28" y="21" width="20" height="5" rx="2" fill={armorColor} />
      {/* Cheek guards */}
      <path d="M 24 22 L 17 28 L 20 34 L 26 30 Z" fill={bodyColor} />
      <path d="M 52 22 L 59 28 L 56 34 L 50 30 Z" fill={bodyColor} />

      {/* Neck */}
      <rect x="34" y="34" width="8" height="7" rx="1" fill={bodyColor} />

      {/* Pauldrons */}
      <ellipse cx="20" cy="42" rx="10" ry="5" fill={bodyColor} transform="rotate(-15 20 42)" />
      <ellipse cx="56" cy="42" rx="10" ry="5" fill={bodyColor} transform="rotate(15 56 42)" />

      {/* Chest plate */}
      <path d="M 20 40 L 56 40 L 54 66 L 22 66 Z" fill={bodyColor} />
      {/* Chest line */}
      <line x1="38" y1="42" x2="38" y2="64" stroke={armorColor} strokeWidth="1.5" />

      {/* Belt */}
      <rect x="22" y="63" width="32" height="5" rx="1" fill={armorColor} />

      {/* Shield arm */}
      <path d="M 20 44 L 5 58 L 3 71 L 10 73 L 14 63 L 22 50 Z" fill={bodyColor} />
      {/* Shield face */}
      <ellipse cx="4" cy="74" rx="11" ry="15" fill={shieldColor} transform="rotate(-12 4 74)" opacity={isAbsent ? 0.3 : 0.9} />
      {/* Shield rim */}
      <ellipse cx="4" cy="74" rx="11" ry="15" fill="none" stroke="#3b0764" strokeWidth="1.5"
        transform="rotate(-12 4 74)" opacity={isAbsent ? 0 : 0.6} />
      {/* Shield boss */}
      <circle cx="4" cy="74" r="3" fill="#7c3aed" opacity={isAbsent ? 0 : 0.85} />

      {/* Sword arm — animated group, origin at shoulder (56, 44) */}
      <g style={{ transformOrigin: "56px 44px" }}>
        {/* Upper arm */}
        <path d="M 56 44 L 70 30 L 74 34 L 63 50 Z" fill={bodyColor} />
        {/* Sword blade */}
        <path d="M 70 30 L 80 9 L 83 11 L 74 33 Z" fill={swordColor} />
        {/* Crossguard */}
        <rect x="65" y="25" width="15" height="3" rx="1.5" fill="#6b7280"
          transform="rotate(-44 72.5 26.5)" />
        {/* Grip */}
        <rect x="70" y="27" width="4" height="9" rx="1.5" fill="#4b5563"
          transform="rotate(-44 72 31.5)" />
      </g>

      {/* Pteruges (hip skirt) */}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 22 + i * 6.5;
        return (
          <path
            key={i}
            d={`M ${x} 68 L ${x - 2} 86 L ${x + 4.5} 84 L ${x + 6.5} 68 Z`}
            fill={bodyColor}
            opacity={0.85}
          />
        );
      })}

      {/* Left leg (forward) */}
      <path d="M 28 84 L 21 114 L 17 150 L 28 150 L 32 118 L 40 86 Z" fill={bodyColor} />
      {/* Left greave */}
      <rect x="16" y="114" width="14" height="36" rx="3" fill={armorColor} />

      {/* Right leg (back) */}
      <path d="M 44 84 L 53 114 L 57 150 L 68 150 L 64 118 L 54 86 Z" fill={bodyColor} />
      {/* Right greave */}
      <rect x="53" y="114" width="14" height="36" rx="3" fill={armorColor} />

      {/* Feet */}
      <ellipse cx="24" cy="152" rx="11" ry="4" fill={bodyColor} />
      <ellipse cx="60" cy="152" rx="11" ry="4" fill={bodyColor} />

      {/* Last stand glowing eyes */}
      {glowEyes && (
        <>
          <circle cx="32" cy="23" r="3" fill="#ef4444" opacity="0.95" />
          <circle cx="44" cy="23" r="3" fill="#ef4444" opacity="0.95" />
        </>
      )}
    </svg>
  );
}

/* ─── HP bar ───────────────────────────────────────────────── */

function HpBar({ hp, flipDir }: { hp: number; flipDir?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / 1000) * 100));
  const isLow = hp < 200;
  const isMid = hp < 500;
  const barGrad = isLow
    ? "linear-gradient(90deg, #991b1b, #ef4444)"
    : isMid
    ? "linear-gradient(90deg, #92400e, #f97316)"
    : "linear-gradient(90deg, #14532d, #22c55e)";

  return (
    <div className="w-full space-y-0.5">
      <div
        className="flex items-baseline justify-between text-xs font-bold"
        style={flipDir ? { flexDirection: "row-reverse" } : undefined}
      >
        <span
          className={`font-mono tabular-nums text-sm ${isLow ? "text-red-400 animate-pulse" : isMid ? "text-orange-400" : "text-green-400"}`}
        >
          {Math.round(hp)}
        </span>
        <span className="text-white/35 text-[10px]">HP</span>
      </div>
      <div
        className="relative h-5 rounded overflow-hidden w-full"
        style={{
          background: "rgba(0,0,0,0.55)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.7)",
          border: "1px solid rgba(255,255,255,0.06)",
          direction: flipDir ? "rtl" : "ltr",
        }}
      >
        <div
          className="h-full rounded transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: barGrad,
            boxShadow: isLow ? "0 0 10px rgba(239,68,68,0.5)" : undefined,
          }}
        />
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute top-0 h-full w-px bg-black/35"
            style={{ [flipDir ? "right" : "left"]: `${m}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Buff pills ───────────────────────────────────────────── */

function BuffPips({ buffs, align }: { buffs: string[]; align: "left" | "right" }) {
  const vis = buffs.filter((b) => BUFF_LABELS[b]);
  if (!vis.length) return <div className="h-4" />;
  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      style={{ justifyContent: align === "left" ? "flex-start" : "flex-end" }}
    >
      {vis.map((b) => {
        const def = BUFF_LABELS[b];
        return (
          <span
            key={b}
            className="text-[9px] font-bold px-1 py-0.5 rounded"
            style={{
              background: `${def.color}20`,
              color: def.color,
              border: `1px solid ${def.color}40`,
            }}
          >
            {def.emoji} {def.label}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Torch ────────────────────────────────────────────────── */

function Torch() {
  return (
    <div className="flex flex-col items-center gap-0" style={{ width: 20 }}>
      {/* Flame */}
      <div style={{ position: "relative", width: 14, height: 22 }}>
        <div
          className="absolute bottom-0 left-1/2"
          style={{
            width: 10,
            height: 18,
            background: "radial-gradient(ellipse at 50% 80%, #fde68a, #f97316 50%, transparent 80%)",
            borderRadius: "50% 50% 30% 30%",
            transform: "translateX(-50%)",
            animation: "torchFlicker 0.7s ease-in-out infinite alternate",
            filter: "blur(0.5px)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/2"
          style={{
            width: 6,
            height: 12,
            background: "radial-gradient(ellipse at 50% 80%, #fff, #fcd34d 60%, transparent)",
            borderRadius: "50% 50% 30% 30%",
            transform: "translateX(-50%)",
            animation: "torchFlicker 0.5s ease-in-out infinite alternate-reverse",
            filter: "blur(0.3px)",
          }}
        />
      </div>
      {/* Handle */}
      <div
        style={{
          width: 6,
          height: 28,
          background: "linear-gradient(to bottom, #78350f, #451a03)",
          borderRadius: "2px 2px 4px 4px",
        }}
      />
      {/* Bracket */}
      <div style={{ width: 14, height: 5, background: "#374151", borderRadius: 2 }} />
    </div>
  );
}

/* ─── Colosseum arch section (wall + crowd) ─────────────────── */

function ColosseumStands({ excitement }: {
  excitement: "calm" | "stirring" | "excited" | "frenzied" | "erupting";
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (excitement === "calm") return;
    const speed =
      excitement === "erupting" ? 70
      : excitement === "frenzied" ? 110
      : excitement === "excited" ? 200
      : 450;
    const id = setInterval(() => setTick((t) => t + 1), speed);
    return () => clearInterval(id);
  }, [excitement]);

  // 5 arch bays across the top
  const bays = 5;
  const crowdRowsPerBay = 3;

  const crowdAmp =
    excitement === "erupting" ? 12
    : excitement === "frenzied" ? 8
    : excitement === "excited" ? 4
    : excitement === "stirring" ? 1.5
    : 0;

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0d0905 0%, #1a1108 100%)",
        borderBottom: "2px solid rgba(120,80,30,0.25)",
      }}
      aria-hidden
    >
      {/* Stone arch row */}
      <div className="flex w-full" style={{ height: 72 }}>
        {/* Left wall cap */}
        <div
          style={{
            width: 10,
            background: "linear-gradient(90deg, #0a0703, #181108)",
            borderRight: "1px solid rgba(100,70,20,0.3)",
          }}
        />

        {Array.from({ length: bays }).map((_, bayIdx) => (
          <div key={bayIdx} className="flex flex-1 relative overflow-hidden">
            {/* Stone pillar between bays */}
            <div
              style={{
                width: 7,
                background: "linear-gradient(90deg, #1c1509, #251c0c, #1c1509)",
                flexShrink: 0,
                borderRight: "1px solid rgba(120,80,30,0.2)",
              }}
            />
            {/* Arch opening */}
            <div className="flex-1 relative overflow-hidden" style={{ background: "#0a0705" }}>
              {/* Arch curve at bottom of stone wall (creates arch opening shape) */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "55%",
                  background: "#0d0a06",
                  borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                }}
              />
              {/* Crowd rows inside the arch opening */}
              {Array.from({ length: crowdRowsPerBay }).map((_, rowIdx) => {
                const rowOpacity = 0.55 - rowIdx * 0.12;
                const figureCount = 5 + rowIdx;
                const figureH = 9 - rowIdx * 1.5;
                return (
                  <div
                    key={rowIdx}
                    className="absolute left-0 right-0 flex justify-around items-end px-0.5"
                    style={{ bottom: `${28 + rowIdx * 13}%` }}
                  >
                    {Array.from({ length: figureCount }).map((_, fi) => {
                      const globalIdx = bayIdx * figureCount + fi;
                      const dy =
                        crowdAmp > 0
                          ? Math.sin(globalIdx * 1.1 + tick * 0.55) * crowdAmp * (1 - rowIdx * 0.25)
                          : 0;
                      const armUp =
                        crowdAmp > 3 && Math.sin(globalIdx * 0.9 + tick * 0.45 + 0.6) > 0.3;
                      return (
                        <div
                          key={fi}
                          style={{
                            position: "relative",
                            flexShrink: 0,
                            transform: `translateY(${dy}px)`,
                            transition: "transform 0.1s ease",
                          }}
                        >
                          {armUp && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: figureH - 1,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: 2,
                                height: 6,
                                background: `rgba(255,255,255,${rowOpacity * 0.8})`,
                                borderRadius: 1,
                              }}
                            />
                          )}
                          <div
                            style={{
                              width: 5,
                              height: figureH + (globalIdx % 3) * 2,
                              background: `rgba(255,255,255,${rowOpacity})`,
                              borderRadius: "3px 3px 0 0",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Right wall cap */}
        <div
          style={{
            width: 10,
            background: "linear-gradient(90deg, #181108, #0a0703)",
            borderLeft: "1px solid rgba(100,70,20,0.3)",
          }}
        />
      </div>

      {/* Lower stone ledge / parapet */}
      <div
        style={{
          height: 8,
          background: "linear-gradient(180deg, #1e1609, #2a1e0c)",
          borderTop: "1px solid rgba(120,80,30,0.3)",
          boxShadow: "0 3px 8px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

/* ─── Individual gladiator slot ─────────────────────────────── */

function GladiatorSlot({
  name,
  hp,
  wordCount,
  buffs,
  facingRight,
  isRunning,
  isAbsent,
}: {
  name: string;
  hp: number;
  wordCount: number;
  buffs: string[];
  facingRight: boolean;
  isRunning: boolean;
  isAbsent?: boolean;
}) {
  const isLastStand = hp < 200;
  const prevWC = useRef(wordCount);
  const [slashing, setSlashing] = useState(false);
  const slashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) return;
    if (wordCount > prevWC.current) {
      setSlashing(true);
      if (slashTimer.current !== undefined) clearTimeout(slashTimer.current);
      slashTimer.current = setTimeout(() => setSlashing(false), 380);
    }
    prevWC.current = wordCount;
  }, [wordCount, isRunning]);

  const nameColor = facingRight ? "#a78bfa" : "#f87171";
  const nameBg = facingRight ? "rgba(139,92,246,0.12)" : "rgba(248,113,113,0.12)";
  const nameBorder = facingRight ? "rgba(139,92,246,0.28)" : "rgba(248,113,113,0.28)";

  return (
    <div
      className="flex flex-col items-center gap-1"
      style={{ flex: 1, minWidth: 0, opacity: isAbsent ? 0.6 : 1, transition: "opacity 0.4s ease" }}
    >
      {/* HP bar */}
      <div className="w-full px-1">
        <HpBar hp={hp} flipDir={!facingRight} />
      </div>
      {/* Buffs */}
      <div className="w-full px-1">
        <BuffPips buffs={buffs} align={facingRight ? "left" : "right"} />
      </div>
      {/* Name tag */}
      <div
        className="text-xs font-bold truncate max-w-full px-2 py-0.5 rounded"
        style={{ color: nameColor, background: nameBg, border: `1px solid ${nameBorder}` }}
        title={name}
      >
        {isAbsent ? "???" : name}
      </div>
      {/* Figure */}
      <div
        style={{
          width: 80,
          height: 120,
          position: "relative",
          animation: isLastStand && !isAbsent ? "lastStandShake 0.18s infinite" : undefined,
        }}
      >
        <GladiatorSVG
          facingRight={facingRight}
          isLastStand={isLastStand}
          isAbsent={isAbsent}
          isSlashing={slashing && !isAbsent}
        />
      </div>
      {/* Word count */}
      <div
        className="text-[11px] font-mono tabular-nums"
        style={{ color: isAbsent ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)" }}
      >
        {isAbsent ? "— words" : `${wordCount} words`}
      </div>
    </div>
  );
}

/* ─── Main exported component ───────────────────────────────── */

export function GladiatorHUD({ state, deathGap, myName, opponentName, isRunning }: GladiatorHUDProps) {
  const { myHp, opponentHp, myWordCount, opponentWordCount, gap, iAhead, myBuffs, opponentBuffs } = state;

  const gapRatio = deathGap > 0 ? Math.min(1, gap / deathGap) : 0;
  const excitement =
    myHp < 200 || opponentHp < 200 ? "erupting"
    : gapRatio >= 0.75 ? "frenzied"
    : gapRatio >= 0.5 ? "excited"
    : gapRatio >= 0.25 ? "stirring"
    : "calm";

  const hasOpponent = opponentName !== null;

  return (
    <div
      className="w-full rounded-xl overflow-hidden select-none"
      style={{
        background: "#0d0a06",
        border: "1px solid rgba(150,100,30,0.2)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(200,150,50,0.07)",
      }}
    >
      {/* ── Colosseum stands ── */}
      <ColosseumStands excitement={excitement} />

      {/* ── Arena header bar (torches + status) ── */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          background: "linear-gradient(180deg, #1a1208, #120e06)",
          borderBottom: "1px solid rgba(120,80,20,0.2)",
        }}
      >
        <Torch />
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{
            color:
              excitement === "erupting" ? "#ef4444"
              : excitement === "frenzied" ? "#f97316"
              : "#a16207",
            textShadow: excitement === "erupting" ? "0 0 8px rgba(239,68,68,0.6)" : undefined,
          }}
        >
          {isRunning
            ? excitement === "erupting" ? "⚔ Last Stand ⚔"
            : excitement === "frenzied" ? "⚔ Danger ⚔"
            : "⚔ Combat ⚔"
            : hasOpponent ? "⚔ Arena ⚔" : "⚔ Awaiting Challenger ⚔"}
        </span>
        <Torch />
      </div>

      {/* ── Main arena floor ── */}
      <div
        className="relative"
        style={{
          background: "linear-gradient(180deg, #120e07 0%, #1a1509 55%, #231a0b 100%)",
          padding: "10px 12px 6px",
        }}
      >
        {/* Warm sand glow on floor */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: "30%",
            background: "linear-gradient(to top, rgba(180,130,50,0.07), transparent)",
            pointerEvents: "none",
          }}
        />

        <div className="flex items-end gap-1 relative">
          {/* Left gladiator — always the player */}
          <GladiatorSlot
            name={myName}
            hp={myHp}
            wordCount={myWordCount}
            buffs={myBuffs}
            facingRight={true}
            isRunning={isRunning}
          />

          {/* Centre VS column */}
          <div
            className="flex flex-col items-center shrink-0 pb-2 gap-1"
            style={{ width: 36 }}
          >
            {isRunning && gapRatio > 0 && (
              <div
                className="text-[9px] font-bold text-center leading-none tabular-nums"
                style={{ color: gapRatio >= 0.75 ? "#ef4444" : gapRatio >= 0.5 ? "#f97316" : "#6b7280" }}
              >
                {iAhead ? "▲" : "▼"}
                <br />
                {gap}
              </div>
            )}
            <div
              className="text-base leading-none"
              style={{
                filter: "drop-shadow(0 0 5px rgba(250,200,60,0.5))",
                animation: isRunning && gapRatio >= 0.75 ? "pulse 0.5s infinite" : undefined,
              }}
            >
              ⚔️
            </div>
          </div>

          {/* Right gladiator — opponent or waiting */}
          <GladiatorSlot
            name={opponentName ?? "???"}
            hp={opponentHp}
            wordCount={opponentWordCount}
            buffs={opponentBuffs}
            facingRight={false}
            isRunning={isRunning}
            isAbsent={!hasOpponent}
          />
        </div>
      </div>

      {/* ── Sand floor strip ── */}
      <div
        style={{
          height: 10,
          background: "linear-gradient(180deg, rgba(160,120,50,0.18) 0%, rgba(100,75,30,0.1) 100%)",
          borderTop: "1px solid rgba(160,120,50,0.15)",
        }}
      />
    </div>
  );
}
