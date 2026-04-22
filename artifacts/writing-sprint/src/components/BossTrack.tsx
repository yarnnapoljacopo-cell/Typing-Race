import { memo, useRef } from "react";
import { Participant } from "@/hooks/useSprintRoom";
import { motion, AnimatePresence } from "framer-motion";

interface BossTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
  bossWordGoal: number;
  bossDefeated?: boolean;
}

const FIGURE_COLORS = [
  "#e85d3c", "#2563eb", "#16a34a",
  "#d97706", "#7c3aed", "#0891b2",
];

// ── Tier config (based on word goal) ─────────────────────────────────────────

interface TierConfig {
  name: string;
  subtitle: string;
  bodyColor: string;
  headColor: string;
  hornColor: string;
  accentColor: string;
  svgSize: number;
}

function getTierConfig(bossWordGoal: number): TierConfig & { tier: number } {
  if (bossWordGoal > 10000) return {
    tier: 3,
    name: "Eldritch Horror",
    subtitle: "ancient, nameless, world-ending",
    bodyColor: "#020617",
    headColor: "#0c0a1e",
    hornColor: "#1d4ed8",
    accentColor: "#38bdf8",
    svgSize: 108,
  };
  if (bossWordGoal > 5000) return {
    tier: 2,
    name: "Void Tyrant",
    subtitle: "armored in darkness, merciless",
    bodyColor: "#3b0000",
    headColor: "#7f1d1d",
    hornColor: "#b91c1c",
    accentColor: "#f87171",
    svgSize: 94,
  };
  if (bossWordGoal > 2500) return {
    tier: 1,
    name: "Dark Wraith",
    subtitle: "swift and cruel, hunts the silent",
    bodyColor: "#0f172a",
    headColor: "#1e293b",
    hornColor: "#6d28d9",
    accentColor: "#a78bfa",
    svgSize: 80,
  };
  return {
    tier: 0,
    name: "Shadow Imp",
    subtitle: "small, wicked, surprisingly deadly",
    bodyColor: "#1e1b4b",
    headColor: "#312e81",
    hornColor: "#4c1d95",
    accentColor: "#c4b5fd",
    svgSize: 68,
  };
}

// ── Stage config (based on HP %) ──────────────────────────────────────────────

interface StageConfig {
  label: string | null;
  labelColor: string;
  eyeColor: string;
  eyeGlow: string;
  shakeRange: number;
  shakeDuration: number;
}

function getStageConfig(healthPercent: number): StageConfig & { stage: number } {
  if (healthPercent <= 15) return {
    stage: 3,
    label: "BERSERK",
    labelColor: "#ef4444",
    eyeColor: "#ff0000",
    eyeGlow: "drop-shadow(0 0 6px #ef4444) drop-shadow(0 0 12px #ef4444)",
    shakeRange: 7,
    shakeDuration: 0.15,
  };
  if (healthPercent <= 40) return {
    stage: 2,
    label: "Enraged",
    labelColor: "#f97316",
    eyeColor: "#ef4444",
    eyeGlow: "drop-shadow(0 0 4px #f97316)",
    shakeRange: 4,
    shakeDuration: 0.25,
  };
  if (healthPercent <= 70) return {
    stage: 1,
    label: "Angered",
    labelColor: "#fbbf24",
    eyeColor: "#f97316",
    eyeGlow: "drop-shadow(0 0 3px #fbbf24)",
    shakeRange: 2,
    shakeDuration: 0.4,
  };
  return {
    stage: 0,
    label: null,
    labelColor: "transparent",
    eyeColor: "#1a1a1a",
    eyeGlow: "none",
    shakeRange: 2,
    shakeDuration: 3,
  };
}

// ── Boss SVG bodies ───────────────────────────────────────────────────────────

function ImpSvg({ cfg, eyeColor, stage, defeated }: {
  cfg: TierConfig; eyeColor: string; stage: number; defeated: boolean;
}) {
  const c = cfg;
  return (
    <svg viewBox="0 0 68 78" width={c.svgSize} height={c.svgSize * (78 / 68)} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Single center horn */}
      <polygon points="34,4 30,20 38,20" fill={c.hornColor} />
      {/* Head */}
      <ellipse cx="34" cy="30" rx="18" ry="16" fill={defeated ? "#374151" : c.headColor} />
      {/* Eyes */}
      <circle cx="27" cy="28" r="5" fill="white" />
      <circle cx="41" cy="28" r="5" fill="white" />
      <circle cx="27" cy="28" r="3" fill={defeated ? "#9ca3af" : eyeColor} />
      <circle cx="41" cy="28" r="3" fill={defeated ? "#9ca3af" : eyeColor} />
      {/* Pupils */}
      {!defeated && <circle cx="27.5" cy="27.5" r="1" fill="white" opacity="0.8" />}
      {!defeated && <circle cx="41.5" cy="27.5" r="1" fill="white" opacity="0.8" />}
      {/* Mouth */}
      {!defeated
        ? <path d="M27 37 Q34 43 41 37" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        : <path d="M27 40 Q34 36 41 40" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {/* Fangs */}
      {!defeated && <polygon points="31,43 29,48 33,47" fill="white" />}
      {!defeated && <polygon points="37,43 35,47 39,48" fill="white" />}
      {/* Body */}
      <ellipse cx="34" cy="60" rx="16" ry="16" fill={defeated ? "#374151" : c.bodyColor} />
      {/* Claws */}
      <path d="M18 55 L10 50 L12 62" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M50 55 L58 50 L56 62" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Damage marks */}
      {!defeated && stage >= 2 && (
        <>
          <line x1="24" y1="22" x2="32" y2="34" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="36" y1="22" x2="44" y2="34" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      {/* Rage aura */}
      {!defeated && stage === 3 && (
        <ellipse cx="34" cy="30" rx="22" ry="20" stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="4 3" opacity="0.6" />
      )}
    </svg>
  );
}

function WraithSvg({ cfg, eyeColor, stage, defeated }: {
  cfg: TierConfig; eyeColor: string; stage: number; defeated: boolean;
}) {
  const c = cfg;
  return (
    <svg viewBox="0 0 80 90" width={c.svgSize} height={c.svgSize * (90 / 80)} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Two curved horns */}
      <path d="M26 18 Q18 4 22 2 Q26 4 28 16" fill={defeated ? "#4b5563" : c.hornColor} />
      <path d="M54 18 Q62 4 58 2 Q54 4 52 16" fill={defeated ? "#4b5563" : c.hornColor} />
      {/* Head */}
      <ellipse cx="40" cy="32" rx="20" ry="18" fill={defeated ? "#374151" : c.headColor} />
      {/* Eyes */}
      <circle cx="32" cy="30" r="5.5" fill="white" />
      <circle cx="48" cy="30" r="5.5" fill="white" />
      <circle cx="32" cy="30" r="3.5" fill={defeated ? "#9ca3af" : eyeColor} />
      <circle cx="48" cy="30" r="3.5" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="32.7" cy="29.3" r="1.2" fill="white" opacity="0.7" />}
      {!defeated && <circle cx="48.7" cy="29.3" r="1.2" fill="white" opacity="0.7" />}
      {/* Angry brow */}
      {!defeated && <line x1="26" y1="22" x2="36" y2="26" stroke={c.hornColor} strokeWidth="2.5" strokeLinecap="round" />}
      {!defeated && <line x1="54" y1="22" x2="44" y2="26" stroke={c.hornColor} strokeWidth="2.5" strokeLinecap="round" />}
      {/* Mouth */}
      {!defeated
        ? <path d="M30 41 Q40 48 50 41" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        : <path d="M30 44 Q40 39 50 44" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {!defeated && <polygon points="36,48 34,54 38,53" fill="white" />}
      {!defeated && <polygon points="44,48 42,53 46,54" fill="white" />}
      {/* Body */}
      <ellipse cx="40" cy="68" rx="20" ry="20" fill={defeated ? "#374151" : c.bodyColor} />
      {/* Wispy bottom */}
      {!defeated && <path d="M20 75 Q25 85 30 78 Q35 88 40 80 Q45 90 50 80 Q55 88 60 75" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.4" />}
      {/* Claws */}
      <path d="M20 63 L11 56 L14 69" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 63 L69 56 L66 69" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Damage */}
      {!defeated && stage >= 2 && (
        <>
          <line x1="28" y1="25" x2="37" y2="39" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="43" y1="24" x2="52" y2="36" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      {!defeated && stage === 3 && (
        <>
          <ellipse cx="40" cy="32" rx="25" ry="23" stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="5 3" opacity="0.5" />
          <ellipse cx="40" cy="32" rx="28" ry="26" stroke="#ef4444" strokeWidth="1" fill="none" strokeDasharray="3 5" opacity="0.3" />
        </>
      )}
    </svg>
  );
}

function TyrantSvg({ cfg, eyeColor, stage, defeated }: {
  cfg: TierConfig; eyeColor: string; stage: number; defeated: boolean;
}) {
  const c = cfg;
  return (
    <svg viewBox="0 0 94 106" width={c.svgSize} height={c.svgSize * (106 / 94)} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Four horns */}
      <polygon points="30,22 24,4 34,16" fill={defeated ? "#4b5563" : c.hornColor} />
      <polygon points="64,22 70,4 60,16" fill={defeated ? "#4b5563" : c.hornColor} />
      <polygon points="42,18 38,6 46,14" fill={defeated ? "#4b5563" : c.hornColor} opacity="0.8" />
      <polygon points="52,18 56,6 48,14" fill={defeated ? "#4b5563" : c.hornColor} opacity="0.8" />
      {/* Wing hints */}
      {!defeated && <path d="M14 55 Q4 42 10 35 Q20 48 22 56" fill={c.hornColor} opacity="0.4" />}
      {!defeated && <path d="M80 55 Q90 42 84 35 Q74 48 72 56" fill={c.hornColor} opacity="0.4" />}
      {/* Head */}
      <ellipse cx="47" cy="36" rx="24" ry="22" fill={defeated ? "#374151" : c.headColor} />
      {/* Eyes - larger, more menacing */}
      <ellipse cx="37" cy="33" rx="7" ry="6" fill="white" />
      <ellipse cx="57" cy="33" rx="7" ry="6" fill="white" />
      <ellipse cx="37" cy="33" rx="5" ry="4" fill={defeated ? "#9ca3af" : eyeColor} />
      <ellipse cx="57" cy="33" rx="5" ry="4" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="37.8" cy="32" r="1.5" fill="white" opacity="0.7" />}
      {!defeated && <circle cx="57.8" cy="32" r="1.5" fill="white" opacity="0.7" />}
      {/* Heavy brow ridge */}
      {!defeated && <path d="M28 24 Q37 28 38 29" stroke={c.hornColor} strokeWidth="3.5" strokeLinecap="round" />}
      {!defeated && <path d="M66 24 Q57 28 56 29" stroke={c.hornColor} strokeWidth="3.5" strokeLinecap="round" />}
      {/* Mouth - jagged */}
      {!defeated ? (
        <>
          <path d="M33 46 Q47 56 61 46" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <polygon points="39,56 36,62 42,61" fill="white" />
          <polygon points="47,58 44,64 50,63" fill="white" />
          <polygon points="55,56 52,61 58,62" fill="white" />
        </>
      ) : (
        <path d="M33 52 Q47 46 61 52" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* Body */}
      <ellipse cx="47" cy="80" rx="26" ry="24" fill={defeated ? "#374151" : c.bodyColor} />
      {/* Armored chest plate */}
      {!defeated && <ellipse cx="47" cy="76" rx="14" ry="12" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.4" />}
      {/* Heavy claws */}
      <path d="M21 72 L10 62 L14 76 M14 62 L8 72" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M73 72 L84 62 L80 76 M80 62 L86 72" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Damage */}
      {!defeated && stage >= 2 && (
        <>
          <line x1="32" y1="26" x2="44" y2="44" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="50" y1="25" x2="62" y2="40" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        </>
      )}
      {!defeated && stage === 3 && (
        <>
          <ellipse cx="47" cy="36" rx="30" ry="28" stroke="#ef4444" strokeWidth="2.5" fill="none" strokeDasharray="6 3" opacity="0.6" />
          <ellipse cx="47" cy="36" rx="34" ry="32" stroke="#f97316" strokeWidth="1.5" fill="none" strokeDasharray="4 6" opacity="0.3" />
        </>
      )}
    </svg>
  );
}

function HorrSvg({ cfg, eyeColor, stage, defeated }: {
  cfg: TierConfig; eyeColor: string; stage: number; defeated: boolean;
}) {
  const c = cfg;
  return (
    <svg viewBox="0 0 108 120" width={c.svgSize} height={c.svgSize * (120 / 108)} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Spike crown */}
      <polygon points="54,2 49,20 59,20" fill={defeated ? "#374151" : c.hornColor} />
      <polygon points="38,8 30,24 40,22" fill={defeated ? "#374151" : c.hornColor} opacity="0.9" />
      <polygon points="70,8 78,24 68,22" fill={defeated ? "#374151" : c.hornColor} opacity="0.9" />
      <polygon points="24,18 14,30 26,30" fill={defeated ? "#374151" : c.hornColor} opacity="0.6" />
      <polygon points="84,18 94,30 82,30" fill={defeated ? "#374151" : c.hornColor} opacity="0.6" />
      {/* Tentacle appendages */}
      {!defeated && (
        <>
          <path d="M10 70 Q2 60 6 48 Q14 55 14 65 Q8 55 10 45" stroke={c.accentColor} strokeWidth="2.5" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M98 70 Q106 60 102 48 Q94 55 94 65 Q100 55 98 45" stroke={c.accentColor} strokeWidth="2.5" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M14 85 Q4 78 6 64 Q16 70 18 80" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M94 85 Q104 78 102 64 Q92 70 90 80" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
        </>
      )}
      {/* Head */}
      <ellipse cx="54" cy="42" rx="28" ry="26" fill={defeated ? "#374151" : c.headColor} />
      {/* Void aura on head */}
      {!defeated && <ellipse cx="54" cy="42" rx="28" ry="26" stroke={c.accentColor} strokeWidth="1" fill="none" opacity="0.3" />}
      {/* Standard eyes */}
      <ellipse cx="42" cy="38" rx="7.5" ry="6.5" fill="white" />
      <ellipse cx="66" cy="38" rx="7.5" ry="6.5" fill="white" />
      <ellipse cx="42" cy="38" rx="5.5" ry="4.5" fill={defeated ? "#9ca3af" : eyeColor} />
      <ellipse cx="66" cy="38" rx="5.5" ry="4.5" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="42.9" cy="37" r="1.8" fill="white" opacity="0.6" />}
      {!defeated && <circle cx="66.9" cy="37" r="1.8" fill="white" opacity="0.6" />}
      {/* Third eye (center forehead) */}
      <ellipse cx="54" cy="30" rx="5" ry="4.5" fill={defeated ? "#4b5563" : "white"} />
      <ellipse cx="54" cy="30" rx="3.5" ry="3" fill={defeated ? "#6b7280" : eyeColor} />
      {!defeated && <circle cx="54.6" cy="29.2" r="1.2" fill="white" opacity="0.7" />}
      {!defeated && stage >= 1 && <ellipse cx="54" cy="30" rx="6" ry="5.5" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.5" />}
      {/* Brow */}
      {!defeated && <path d="M32 27 Q42 32 44 34" stroke={c.hornColor} strokeWidth="4" strokeLinecap="round" />}
      {!defeated && <path d="M76 27 Q66 32 64 34" stroke={c.hornColor} strokeWidth="4" strokeLinecap="round" />}
      {/* Mouth */}
      {!defeated ? (
        <>
          <path d="M37 54 Q54 66 71 54" stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round" />
          <polygon points="44,66 41,73 47,72" fill="white" />
          <polygon points="54,69 51,76 57,75" fill="white" />
          <polygon points="64,66 61,72 67,73" fill="white" />
        </>
      ) : (
        <path d="M37 60 Q54 54 71 60" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* Body */}
      <ellipse cx="54" cy="94" rx="30" ry="26" fill={defeated ? "#374151" : c.bodyColor} />
      {!defeated && <ellipse cx="54" cy="88" rx="16" ry="14" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.3" />}
      {/* Massive claws */}
      <path d="M24 86 L12 74 L17 90 M17 74 L10 86 M13 68 L18 82" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M84 86 L96 74 L91 90 M91 74 L98 86 M95 68 L90 82" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Damage marks */}
      {!defeated && stage >= 2 && (
        <>
          <line x1="38" y1="30" x2="52" y2="52" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <line x1="56" y1="28" x2="70" y2="46" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <line x1="45" y1="52" x2="56" y2="68" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
      {/* Rage rings */}
      {!defeated && stage >= 3 && (
        <>
          <ellipse cx="54" cy="42" rx="36" ry="34" stroke="#ef4444" strokeWidth="3" fill="none" strokeDasharray="7 4" opacity="0.7" />
          <ellipse cx="54" cy="42" rx="42" ry="40" stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="5 7" opacity="0.4" />
          <ellipse cx="54" cy="42" rx="48" ry="46" stroke={c.accentColor} strokeWidth="1" fill="none" strokeDasharray="3 9" opacity="0.2" />
        </>
      )}
    </svg>
  );
}

// ── Boss Monster wrapper ──────────────────────────────────────────────────────

function BossMonster({ healthPercent, defeated, bossWordGoal }: {
  healthPercent: number;
  defeated: boolean;
  bossWordGoal: number;
}) {
  const tierCfg = getTierConfig(bossWordGoal);
  const stageCfg = defeated
    ? { stage: 0, label: null, labelColor: "transparent", eyeColor: "#6b7280", eyeGlow: "none", shakeRange: 0, shakeDuration: 1 }
    : getStageConfig(healthPercent);

  const shakeAnim = stageCfg.shakeRange > 0
    ? { x: Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? -stageCfg.shakeRange : stageCfg.shakeRange).toString()) }
    : {};

  const svgProps = {
    cfg: tierCfg,
    eyeColor: stageCfg.eyeColor,
    stage: stageCfg.stage,
    defeated,
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className="relative flex-shrink-0"
        style={{ filter: !defeated && stageCfg.stage >= 1 ? stageCfg.eyeGlow : "none" }}
        animate={
          defeated
            ? { scale: [1, 0.8], opacity: [1, 0] }
            : stageCfg.stage >= 1
            ? shakeAnim
            : { x: [0, -2, 2, -2, 0] }
        }
        transition={
          defeated
            ? { duration: 1.5, ease: "easeOut" }
            : stageCfg.stage >= 1
            ? { repeat: Infinity, duration: stageCfg.shakeDuration, ease: "easeInOut" }
            : { repeat: Infinity, duration: 3, ease: "easeInOut" }
        }
      >
        {tierCfg.tier === 0 && <ImpSvg {...svgProps} />}
        {tierCfg.tier === 1 && <WraithSvg {...svgProps} />}
        {tierCfg.tier === 2 && <TyrantSvg {...svgProps} />}
        {tierCfg.tier === 3 && <HorrSvg {...svgProps} />}

        {/* Damage number */}
        {!defeated && healthPercent < 100 && (
          <motion.div
            className="absolute -top-4 left-1/2 -translate-x-1/2 font-bold text-xs pointer-events-none"
            style={{ color: tierCfg.accentColor }}
            animate={{ y: [0, -22], opacity: [1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
          >
            -{Math.floor(Math.random() * 50 + 10)}
          </motion.div>
        )}
      </motion.div>

      {/* Stage label */}
      <AnimatePresence>
        {!defeated && stageCfg.label && (
          <motion.div
            key={stageCfg.label}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              color: stageCfg.labelColor,
              background: `${stageCfg.labelColor}20`,
              border: `1px solid ${stageCfg.labelColor}50`,
              textShadow: stageCfg.stage === 3 ? `0 0 6px ${stageCfg.labelColor}` : "none",
            }}
          >
            {stageCfg.label}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Boss name */}
      {!defeated ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: tierCfg.accentColor }}>
          {tierCfg.name}
        </span>
      ) : (
        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Defeated!</span>
      )}
    </div>
  );
}

// ── Fighter figure ────────────────────────────────────────────────────────────

function FigureIcon({ color, attacking }: { color: string; attacking: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 36"
      width="24"
      height="36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={attacking ? { x: [0, 4, 0] } : {}}
      transition={attacking ? { repeat: Infinity, duration: 0.5, ease: "easeInOut" } : {}}
    >
      <circle cx="12" cy="5" r="4" fill={color} />
      <rect x="9" y="10" width="6" height="10" rx="2" fill={color} />
      <motion.line
        x1="9" y1="13" x2="3" y2={attacking ? "8" : "16"}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={attacking ? { y2: [16, 8, 16] } : {}}
        transition={attacking ? { repeat: Infinity, duration: 0.5 } : {}}
      />
      <line x1="15" y1="13" x2="21" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="10" y1="20" x2="8" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="20" x2="16" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {attacking && (
        <line x1="3" y1="8" x2="-3" y2="2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      )}
    </motion.svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const BossTrack = memo(function BossTrack({
  participants,
  currentParticipantId,
  bossWordGoal,
  bossDefeated = false,
}: BossTrackProps) {
  const laneMap = useRef<Map<string, number>>(new Map());
  const nextLane = useRef(0);
  participants.forEach((p) => {
    if (!laneMap.current.has(p.id)) {
      laneMap.current.set(p.id, nextLane.current++);
    }
  });

  const bossTotalWords = participants.reduce((sum, p) => sum + p.wordCount, 0);
  const healthPercent = Math.max(0, Math.min(100, 100 - (bossTotalWords / Math.max(1, bossWordGoal)) * 100));
  const progressPercent = Math.min(100, (bossTotalWords / Math.max(1, bossWordGoal)) * 100);
  const tierCfg = getTierConfig(bossWordGoal);

  return (
    <div
      className="w-full rounded-xl overflow-hidden shadow-sm border"
      style={{ background: "#0a0814", borderColor: `${tierCfg.accentColor}30` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: `${tierCfg.accentColor}20` }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: tierCfg.accentColor }}>
          ⚔️ Boss Battle
        </span>
        <span className="text-white/50 text-xs font-mono">
          {bossTotalWords.toLocaleString()} / {bossWordGoal.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "fighter" : "fighters"}
        </span>
      </div>

      {/* Boss HP bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Boss HP</span>
          <span className="text-xs font-mono text-red-300">{Math.ceil(healthPercent)}%</span>
        </div>
        <div className="h-4 bg-red-950 rounded-full overflow-hidden border border-red-800/50">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: healthPercent > 50
                ? "linear-gradient(90deg, #dc2626, #ef4444)"
                : healthPercent > 25
                ? "linear-gradient(90deg, #ea580c, #f97316)"
                : "linear-gradient(90deg, #7f1d1d, #dc2626)",
              boxShadow: "0 0 8px rgba(220,38,38,0.5)",
            }}
            animate={{ width: `${healthPercent}%` }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.8 }}
          />
        </div>
      </div>

      {/* Battle scene */}
      <div className="relative flex items-end justify-between px-4 pb-4 pt-2 gap-2">
        {/* Fighters */}
        <div className="flex flex-col gap-2 flex-1">
          {participants.length === 0 ? (
            <div className="text-white/30 text-xs italic py-4 text-center">Waiting for fighters…</div>
          ) : (
            participants.map((p) => {
              const laneIndex = laneMap.current.get(p.id) ?? 0;
              const color = FIGURE_COLORS[laneIndex % FIGURE_COLORS.length];
              const isMe = p.id === currentParticipantId;
              const contribution = bossTotalWords > 0 ? Math.round((p.wordCount / bossTotalWords) * 100) : 0;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <FigureIcon color={color} attacking={p.wordCount > 0 && !bossDefeated} />
                  <div className="flex flex-col min-w-0">
                    <div
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{
                        background: isMe ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                        border: isMe ? `1px solid ${color}` : "1px solid transparent",
                        color: "white",
                      }}
                    >
                      <span className="truncate max-w-[70px]">{isMe ? "You" : p.name}</span>
                      <span className="font-mono opacity-80">{p.wordCount}w</span>
                    </div>
                    {bossTotalWords > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="h-1 rounded-full flex-1 bg-white/10 overflow-hidden" style={{ maxWidth: "80px" }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${contribution}%`, background: color }} />
                        </div>
                        <span className="text-[9px] font-mono" style={{ color }}>{contribution}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* VS flash */}
        <div className="flex flex-col items-center gap-1 self-center px-2">
          {!bossDefeated && bossTotalWords > 0 && (
            <AnimatePresence>
              <motion.div
                key="slash"
                initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8], rotate: [-20, 10, -20] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.2 }}
                className="text-yellow-400 font-black text-lg"
              >
                ⚡
              </motion.div>
            </AnimatePresence>
          )}
          {bossDefeated && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ duration: 0.6 }}
              className="text-2xl"
            >
              🎉
            </motion.div>
          )}
        </div>

        {/* Boss */}
        <div className="flex flex-col items-center shrink-0">
          <BossMonster healthPercent={healthPercent} defeated={bossDefeated} bossWordGoal={bossWordGoal} />
          {!bossDefeated && (
            <span className="text-xs font-mono text-red-300 mt-1">
              {Math.max(0, bossWordGoal - bossTotalWords).toLocaleString()}w left
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: bossDefeated
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : `linear-gradient(90deg, ${tierCfg.hornColor}, ${tierCfg.accentColor})`,
              boxShadow: bossDefeated ? "0 0 8px rgba(34,197,94,0.5)" : `0 0 8px ${tierCfg.accentColor}60`,
            }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.8 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/30">0</span>
          <span className="text-[10px] text-white/30">{bossWordGoal.toLocaleString()} words to defeat boss</span>
        </div>
      </div>
    </div>
  );
});
