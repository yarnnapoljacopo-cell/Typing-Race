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
      <polygon points="34,4 30,20 38,20" fill={c.hornColor} />
      <ellipse cx="34" cy="30" rx="18" ry="16" fill={defeated ? "#374151" : c.headColor} />
      <circle cx="27" cy="28" r="5" fill="white" />
      <circle cx="41" cy="28" r="5" fill="white" />
      <circle cx="27" cy="28" r="3" fill={defeated ? "#9ca3af" : eyeColor} />
      <circle cx="41" cy="28" r="3" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="27.5" cy="27.5" r="1" fill="white" opacity="0.8" />}
      {!defeated && <circle cx="41.5" cy="27.5" r="1" fill="white" opacity="0.8" />}
      {!defeated
        ? <path d="M27 37 Q34 43 41 37" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        : <path d="M27 40 Q34 36 41 40" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {!defeated && <polygon points="31,43 29,48 33,47" fill="white" />}
      {!defeated && <polygon points="37,43 35,47 39,48" fill="white" />}
      <ellipse cx="34" cy="60" rx="16" ry="16" fill={defeated ? "#374151" : c.bodyColor} />
      <path d="M18 55 L10 50 L12 62" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M50 55 L58 50 L56 62" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      {!defeated && stage >= 2 && (
        <>
          <line x1="24" y1="22" x2="32" y2="34" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="36" y1="22" x2="44" y2="34" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </>
      )}
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
      <path d="M26 18 Q18 4 22 2 Q26 4 28 16" fill={defeated ? "#4b5563" : c.hornColor} />
      <path d="M54 18 Q62 4 58 2 Q54 4 52 16" fill={defeated ? "#4b5563" : c.hornColor} />
      <ellipse cx="40" cy="32" rx="20" ry="18" fill={defeated ? "#374151" : c.headColor} />
      <circle cx="32" cy="30" r="5.5" fill="white" />
      <circle cx="48" cy="30" r="5.5" fill="white" />
      <circle cx="32" cy="30" r="3.5" fill={defeated ? "#9ca3af" : eyeColor} />
      <circle cx="48" cy="30" r="3.5" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="32.7" cy="29.3" r="1.2" fill="white" opacity="0.7" />}
      {!defeated && <circle cx="48.7" cy="29.3" r="1.2" fill="white" opacity="0.7" />}
      {!defeated && <line x1="26" y1="22" x2="36" y2="26" stroke={c.hornColor} strokeWidth="2.5" strokeLinecap="round" />}
      {!defeated && <line x1="54" y1="22" x2="44" y2="26" stroke={c.hornColor} strokeWidth="2.5" strokeLinecap="round" />}
      {!defeated
        ? <path d="M30 41 Q40 48 50 41" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        : <path d="M30 44 Q40 39 50 44" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {!defeated && <polygon points="36,48 34,54 38,53" fill="white" />}
      {!defeated && <polygon points="44,48 42,53 46,54" fill="white" />}
      <ellipse cx="40" cy="68" rx="20" ry="20" fill={defeated ? "#374151" : c.bodyColor} />
      {!defeated && <path d="M20 75 Q25 85 30 78 Q35 88 40 80 Q45 90 50 80 Q55 88 60 75" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.4" />}
      <path d="M20 63 L11 56 L14 69" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M60 63 L69 56 L66 69" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3" fill="none" strokeLinecap="round" />
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
      <polygon points="30,22 24,4 34,16" fill={defeated ? "#4b5563" : c.hornColor} />
      <polygon points="64,22 70,4 60,16" fill={defeated ? "#4b5563" : c.hornColor} />
      <polygon points="42,18 38,6 46,14" fill={defeated ? "#4b5563" : c.hornColor} opacity="0.8" />
      <polygon points="52,18 56,6 48,14" fill={defeated ? "#4b5563" : c.hornColor} opacity="0.8" />
      {!defeated && <path d="M14 55 Q4 42 10 35 Q20 48 22 56" fill={c.hornColor} opacity="0.4" />}
      {!defeated && <path d="M80 55 Q90 42 84 35 Q74 48 72 56" fill={c.hornColor} opacity="0.4" />}
      <ellipse cx="47" cy="36" rx="24" ry="22" fill={defeated ? "#374151" : c.headColor} />
      <ellipse cx="37" cy="33" rx="7" ry="6" fill="white" />
      <ellipse cx="57" cy="33" rx="7" ry="6" fill="white" />
      <ellipse cx="37" cy="33" rx="5" ry="4" fill={defeated ? "#9ca3af" : eyeColor} />
      <ellipse cx="57" cy="33" rx="5" ry="4" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="37.8" cy="32" r="1.5" fill="white" opacity="0.7" />}
      {!defeated && <circle cx="57.8" cy="32" r="1.5" fill="white" opacity="0.7" />}
      {!defeated && <path d="M28 24 Q37 28 38 29" stroke={c.hornColor} strokeWidth="3.5" strokeLinecap="round" />}
      {!defeated && <path d="M66 24 Q57 28 56 29" stroke={c.hornColor} strokeWidth="3.5" strokeLinecap="round" />}
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
      <ellipse cx="47" cy="80" rx="26" ry="24" fill={defeated ? "#374151" : c.bodyColor} />
      {!defeated && <ellipse cx="47" cy="76" rx="14" ry="12" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.4" />}
      <path d="M21 72 L10 62 L14 76 M14 62 L8 72" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M73 72 L84 62 L80 76 M80 62 L86 72" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
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
      <polygon points="54,2 49,20 59,20" fill={defeated ? "#374151" : c.hornColor} />
      <polygon points="38,8 30,24 40,22" fill={defeated ? "#374151" : c.hornColor} opacity="0.9" />
      <polygon points="70,8 78,24 68,22" fill={defeated ? "#374151" : c.hornColor} opacity="0.9" />
      <polygon points="24,18 14,30 26,30" fill={defeated ? "#374151" : c.hornColor} opacity="0.6" />
      <polygon points="84,18 94,30 82,30" fill={defeated ? "#374151" : c.hornColor} opacity="0.6" />
      {!defeated && (
        <>
          <path d="M10 70 Q2 60 6 48 Q14 55 14 65 Q8 55 10 45" stroke={c.accentColor} strokeWidth="2.5" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M98 70 Q106 60 102 48 Q94 55 94 65 Q100 55 98 45" stroke={c.accentColor} strokeWidth="2.5" fill="none" opacity="0.5" strokeLinecap="round" />
          <path d="M14 85 Q4 78 6 64 Q16 70 18 80" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
          <path d="M94 85 Q104 78 102 64 Q92 70 90 80" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="54" cy="42" rx="28" ry="26" fill={defeated ? "#374151" : c.headColor} />
      {!defeated && <ellipse cx="54" cy="42" rx="28" ry="26" stroke={c.accentColor} strokeWidth="1" fill="none" opacity="0.3" />}
      <ellipse cx="42" cy="38" rx="7.5" ry="6.5" fill="white" />
      <ellipse cx="66" cy="38" rx="7.5" ry="6.5" fill="white" />
      <ellipse cx="42" cy="38" rx="5.5" ry="4.5" fill={defeated ? "#9ca3af" : eyeColor} />
      <ellipse cx="66" cy="38" rx="5.5" ry="4.5" fill={defeated ? "#9ca3af" : eyeColor} />
      {!defeated && <circle cx="42.9" cy="37" r="1.8" fill="white" opacity="0.6" />}
      {!defeated && <circle cx="66.9" cy="37" r="1.8" fill="white" opacity="0.6" />}
      <ellipse cx="54" cy="30" rx="5" ry="4.5" fill={defeated ? "#4b5563" : "white"} />
      <ellipse cx="54" cy="30" rx="3.5" ry="3" fill={defeated ? "#6b7280" : eyeColor} />
      {!defeated && <circle cx="54.6" cy="29.2" r="1.2" fill="white" opacity="0.7" />}
      {!defeated && stage >= 1 && <ellipse cx="54" cy="30" rx="6" ry="5.5" stroke={c.accentColor} strokeWidth="1.5" fill="none" opacity="0.5" />}
      {!defeated && <path d="M32 27 Q42 32 44 34" stroke={c.hornColor} strokeWidth="4" strokeLinecap="round" />}
      {!defeated && <path d="M76 27 Q66 32 64 34" stroke={c.hornColor} strokeWidth="4" strokeLinecap="round" />}
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
      <ellipse cx="54" cy="94" rx="30" ry="26" fill={defeated ? "#374151" : c.bodyColor} />
      {!defeated && <ellipse cx="54" cy="88" rx="16" ry="14" stroke={c.accentColor} strokeWidth="2" fill="none" opacity="0.3" />}
      <path d="M24 86 L12 74 L17 90 M17 74 L10 86 M13 68 L18 82" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M84 86 L96 74 L91 90 M91 74 L98 86 M95 68 L90 82" stroke={defeated ? "#4b5563" : c.hornColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      {!defeated && stage >= 2 && (
        <>
          <line x1="38" y1="30" x2="52" y2="52" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <line x1="56" y1="28" x2="70" y2="46" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
          <line x1="45" y1="52" x2="56" y2="68" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      )}
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
    </div>
  );
}

// ── Fighter SVG (writer hero from reference design) ───────────────────────────

function WriterFighterSvg({ attacking }: { attacking: boolean }) {
  return (
    <motion.svg
      width="54"
      height="76"
      viewBox="0 0 64 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 4px 16px rgba(99,102,241,0.6)) drop-shadow(0 0 8px rgba(165,180,252,0.3))" }}
      animate={attacking ? { y: [0, -3, 0] } : { y: [0, -2, 0] }}
      transition={{ repeat: Infinity, duration: attacking ? 0.6 : 1.8, ease: "easeInOut" }}
    >
      {/* Cape */}
      <path d="M24 36 Q14 56 17 78 Q21 80 26 74 Q28 64 32 60 Q36 64 38 74 Q43 80 47 78 Q50 56 40 36 Z" fill="#3730a3" opacity="0.9"/>
      <path d="M25 36 Q17 52 18 70 Q22 74 26 70" fill="rgba(99,102,241,0.3)"/>
      {/* Body armour */}
      <rect x="22" y="34" width="20" height="24" rx="5" fill="#4f46e5"/>
      <rect x="24" y="36" width="16" height="20" rx="3" fill="#6366f1"/>
      {/* Chest rune */}
      <path d="M32 40 L34 44 L32 48 L30 44 Z" fill="#a5b4fc" opacity="0.9"/>
      <path d="M29 43 L35 43" stroke="#a5b4fc" strokeWidth="1" opacity="0.6"/>
      {/* Shoulder pads */}
      <rect x="18" y="34" width="7" height="5" rx="2" fill="#4338ca"/>
      <rect x="39" y="34" width="7" height="5" rx="2" fill="#4338ca"/>
      {/* Head */}
      <circle cx="32" cy="24" r="11" fill="#fcd34d"/>
      {/* Helmet visor */}
      <path d="M21 21 Q21 11 32 11 Q43 11 43 21 L41 23 Q36 16 28 16 L23 23 Z" fill="#3730a3"/>
      <path d="M23 21 Q32 18 41 21" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Eyes */}
      <circle cx="27" cy="24" r="2" fill="white"/>
      <circle cx="37" cy="24" r="2" fill="white"/>
      <circle cx="27.6" cy="24.2" r="1" fill="#1e1b4b"/>
      <circle cx="37.6" cy="24.2" r="1" fill="#1e1b4b"/>
      {/* Quill weapon */}
      <line x1="42" y1="22" x2="60" y2="6" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
      <path d="M60 6 L55 13 L50 9 Z" fill="#fcd34d"/>
      <line x1="42" y1="22" x2="40" y2="27" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Quill tip glow */}
      <circle cx="60" cy="6" r="3" fill="#fef08a" opacity="0.9"/>
      <circle cx="60" cy="6" r="6" fill="rgba(254,240,138,0.25)"/>
      <circle cx="58" cy="3" r="1.2" fill="#fef08a" opacity="0.6"/>
      <circle cx="63" cy="4" r="1" fill="#fef08a" opacity="0.5"/>
      {/* Arms */}
      <path d="M38 40 Q46 32 50 25" stroke="#4f46e5" strokeWidth="6" strokeLinecap="round" fill="none"/>
      <path d="M26 40 Q17 45 14 52" stroke="#4f46e5" strokeWidth="6" strokeLinecap="round" fill="none"/>
      {/* Shield */}
      <rect x="7" y="46" width="14" height="18" rx="4" fill="#3730a3" stroke="#818cf8" strokeWidth="1.5"/>
      <path d="M14 49 L14 62" stroke="#818cf8" strokeWidth="1.2" opacity="0.5"/>
      <path d="M10 55 L18 55" stroke="#818cf8" strokeWidth="1.2" opacity="0.5"/>
      {/* Legs */}
      <rect x="23" y="56" width="8" height="20" rx="4" fill="#3730a3"/>
      <rect x="33" y="56" width="8" height="20" rx="4" fill="#3730a3"/>
      {/* Boots */}
      <rect x="21" y="72" width="11" height="8" rx="3" fill="#1e1b4b"/>
      <rect x="32" y="72" width="11" height="8" rx="3" fill="#1e1b4b"/>
    </motion.svg>
  );
}

function SmallFighterIcon({ color, attacking }: { color: string; attacking: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 36" width="22" height="33" fill="none"
      animate={attacking ? { x: [0, 3, 0] } : {}}
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
    </motion.svg>
  );
}

// ── Particle positions ────────────────────────────────────────────────────────

const PARTICLES = [
  { w: 3, h: 3, color: "#c084fc", top: "20%", left: "12%", dur: 4, delay: 0 },
  { w: 2, h: 2, color: "#ef4444", top: "40%", left: "25%", dur: 5, delay: 0.8 },
  { w: 4, h: 4, color: "#a855f7", top: "15%", left: "45%", dur: 3.5, delay: 0.3 },
  { w: 2, h: 2, color: "#f97316", top: "55%", left: "60%", dur: 4.5, delay: 1.2 },
  { w: 3, h: 3, color: "#c084fc", top: "25%", left: "80%", dur: 5.5, delay: 0.5 },
  { w: 2, h: 2, color: "#ef4444", top: "65%", left: "88%", dur: 4, delay: 2 },
  { w: 3, h: 3, color: "#818cf8", top: "10%", left: "70%", dur: 3.8, delay: 1.5 },
  { w: 2, h: 2, color: "#a855f7", top: "75%", left: "35%", dur: 4.2, delay: 0.7 },
];

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

  const myParticipant = participants.find(p => p.id === currentParticipantId) ?? participants[0] ?? null;
  const otherParticipants = participants.filter(p => p.id !== currentParticipantId);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "#06040f",
        borderRadius: 18,
        position: "relative",
        minHeight: 260,
        boxShadow: "0 0 0 1px rgba(139,0,80,0.3), 0 12px 60px rgba(0,0,0,0.7), 0 0 80px rgba(100,0,160,0.15)",
      }}
    >
      {/* Atmospheric background gradients */}
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 70% 60% at 75% 50%, rgba(120,0,60,0.22) 0%, transparent 65%),
            radial-gradient(ellipse 50% 70% at 25% 50%, rgba(60,0,120,0.18) 0%, transparent 65%),
            radial-gradient(ellipse 80% 40% at 50% 100%, rgba(100,0,30,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 50% 0%, rgba(80,0,140,0.12) 0%, transparent 60%)
          `,
        }}
      />

      {/* Scanlines */}
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", opacity: 0.4,
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
        }}
      />

      {/* Perspective grid floor */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, zIndex: 1, pointerEvents: "none", overflow: "hidden" }}>
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" fill="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="bossFloorFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(120,0,80,0)" />
              <stop offset="100%" stopColor="rgba(80,0,60,0.18)" />
            </linearGradient>
          </defs>
          <rect width="1000" height="100" fill="url(#bossFloorFade)"/>
          <line x1="0" y1="60" x2="1000" y2="60" stroke="rgba(180,0,100,0.12)" strokeWidth="1"/>
          <line x1="0" y1="75" x2="1000" y2="75" stroke="rgba(180,0,100,0.10)" strokeWidth="1"/>
          <line x1="0" y1="88" x2="1000" y2="88" stroke="rgba(180,0,100,0.08)" strokeWidth="1"/>
          <line x1="0" y1="98" x2="1000" y2="98" stroke="rgba(180,0,100,0.06)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="0" y2="100" stroke="rgba(150,0,100,0.08)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="100" y2="100" stroke="rgba(150,0,100,0.07)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="220" y2="100" stroke="rgba(150,0,100,0.06)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="360" y2="100" stroke="rgba(150,0,100,0.05)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="500" y2="100" stroke="rgba(150,0,100,0.05)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="640" y2="100" stroke="rgba(150,0,100,0.05)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="780" y2="100" stroke="rgba(150,0,100,0.06)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="900" y2="100" stroke="rgba(150,0,100,0.07)" strokeWidth="1"/>
          <line x1="500" y1="50" x2="1000" y2="100" stroke="rgba(150,0,100,0.08)" strokeWidth="1"/>
        </svg>
      </div>

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute", borderRadius: "50%", pointerEvents: "none", zIndex: 1,
            width: p.w, height: p.h, background: p.color,
            top: p.top, left: p.left,
          }}
          animate={{ y: [0, -14, 0], scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* ── Header ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px 6px",
          borderBottom: "1px solid rgba(139,0,80,0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.18em", color: "#ff4466", textTransform: "uppercase" }}>
          <motion.div
            style={{
              width: 18, height: 18, borderRadius: 4,
              background: "rgba(255,40,80,0.15)",
              border: "1px solid rgba(255,40,80,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            animate={{ boxShadow: ["0 0 0 0 rgba(255,40,80,0.4)", "0 0 0 4px rgba(255,40,80,0)", "0 0 0 0 rgba(255,40,80,0.4)"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ff4466">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </motion.div>
          Boss Battle
        </div>
        <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
          {bossTotalWords.toLocaleString()} / {bossWordGoal.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "fighter" : "fighters"}
        </span>
      </div>

      {/* ── Boss HP Bar ── */}
      <div style={{ position: "relative", zIndex: 3, padding: "8px 20px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.16em", color: "rgba(255,80,80,0.8)", textTransform: "uppercase" }}>
            ☠ Boss HP
          </span>
          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>
            {Math.ceil(healthPercent)}%
          </span>
        </div>
        <div
          style={{
            height: 14, background: "rgba(0,0,0,0.4)", borderRadius: 99,
            overflow: "hidden", border: "1px solid rgba(255,0,40,0.2)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5) inset, 0 0 20px rgba(180,0,40,0.1)",
            position: "relative",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #7f1d1d 0%, #dc2626 25%, #ef4444 55%, #ff6b6b 78%, #fca5a5 92%, #fff 100%)",
              borderRadius: 99, position: "relative", overflow: "hidden",
            }}
            animate={{
              width: `${healthPercent}%`,
              boxShadow: ["0 0 16px rgba(239,68,68,0.7), 0 0 40px rgba(239,68,68,0.3)", "0 0 24px rgba(239,68,68,0.9), 0 0 60px rgba(239,68,68,0.4)", "0 0 16px rgba(239,68,68,0.7), 0 0 40px rgba(239,68,68,0.3)"],
            }}
            transition={{ width: { type: "tween", ease: "easeOut", duration: 0.8 }, boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
          >
            {/* Shimmer */}
            <motion.div
              style={{
                position: "absolute", top: 2, left: 0, right: 0, height: 4,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
                borderRadius: 99,
              }}
              animate={{ x: ["-200%", "300%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            {/* Tick marks */}
            <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ flex: 1, borderRight: i < 8 ? "1px solid rgba(0,0,0,0.25)" : "none" }} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Battle Stage ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          padding: "10px 32px 0 24px",
          minHeight: 155,
        }}
      >
        {/* Large VS badge */}
        <div
          style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.8rem", fontWeight: 900,
            color: "rgba(255,255,255,0.06)",
            letterSpacing: "-0.04em", pointerEvents: "none", zIndex: 2, userSelect: "none",
          }}
        >
          VS
        </div>

        {/* ── Fighter side ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, zIndex: 3 }}>
          {participants.length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.75rem", fontStyle: "italic", paddingBottom: 16 }}>
              Waiting for fighters…
            </div>
          ) : (
            <>
              {/* Current user — large fighter */}
              {myParticipant && (
                <div
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    position: "relative",
                  }}
                >
                  {/* Fighter aura */}
                  <motion.div
                    style={{
                      position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                      width: 60, height: 12,
                      background: "radial-gradient(ellipse, rgba(99,102,241,0.5) 0%, transparent 70%)",
                      borderRadius: "50%",
                    }}
                    animate={{ opacity: [0.5, 1, 0.5], scaleX: [1, 1.2, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Tag */}
                  <div style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #ddd6fe 100%)", color: "#1e1b4b",
                    fontSize: "0.55rem", fontWeight: 900, letterSpacing: "0.07em",
                    padding: "3px 9px", borderRadius: 6,
                    boxShadow: "0 2px 12px rgba(99,102,241,0.4), 0 0 0 1px rgba(165,180,252,0.5)",
                  }}>
                    You &middot; {myParticipant.wordCount.toLocaleString()}w
                  </div>
                  {/* Hearts */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                    {[0, 0.18, 0.36].map((delay, i) => (
                      <motion.span
                        key={i}
                        style={{ fontSize: "0.7rem", filter: "drop-shadow(0 0 3px rgba(239,68,68,0.7))" }}
                        animate={{ scale: [1, 1.25, 1] }}
                        transition={{ duration: 1.4, delay, repeat: Infinity, ease: "easeInOut" }}
                      >
                        ❤️
                      </motion.span>
                    ))}
                  </div>
                  <WriterFighterSvg attacking={myParticipant.wordCount > 0 && !bossDefeated} />
                </div>
              )}
              {/* Other participants — small icons */}
              {otherParticipants.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {otherParticipants.map((p) => {
                    const laneIndex = laneMap.current.get(p.id) ?? 0;
                    const color = FIGURE_COLORS[laneIndex % FIGURE_COLORS.length];
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <SmallFighterIcon color={color} attacking={p.wordCount > 0 && !bossDefeated} />
                        <div
                          style={{
                            fontSize: "0.6rem", fontWeight: 700,
                            padding: "2px 7px", borderRadius: 5,
                            background: "rgba(255,255,255,0.08)",
                            border: `1px solid ${color}50`,
                            color: "rgba(255,255,255,0.75)",
                          }}
                        >
                          {p.name} &middot; {p.wordCount.toLocaleString()}w
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Boss side ── */}
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            paddingBottom: 6, position: "relative", zIndex: 3,
          }}
        >
          {/* Boss name with glow */}
          {!bossDefeated ? (
            <motion.div
              style={{
                fontSize: "0.7rem", fontWeight: 900, letterSpacing: "0.14em",
                color: "#e879f9", textTransform: "uppercase",
              }}
              animate={{
                textShadow: [
                  "0 0 16px rgba(232,121,249,0.8), 0 0 32px rgba(232,121,249,0.4)",
                  "0 0 24px rgba(232,121,249,1), 0 0 48px rgba(232,121,249,0.6)",
                  "0 0 16px rgba(232,121,249,0.8), 0 0 32px rgba(232,121,249,0.4)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              ☠️ {tierCfg.name}
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.4, 1] }}
              transition={{ duration: 0.6 }}
              style={{ fontSize: "1.4rem" }}
            >
              🎉
            </motion.div>
          )}

          {/* Boss shadow on floor */}
          <motion.div
            style={{
              position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
              width: 90, height: 16,
              background: "radial-gradient(ellipse, rgba(139,0,139,0.5) 0%, transparent 70%)",
              borderRadius: "50%",
            }}
            animate={{ opacity: [0.5, 0.25, 0.5], scaleX: [1, 0.8, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          <BossMonster healthPercent={healthPercent} defeated={bossDefeated} bossWordGoal={bossWordGoal} />

          {!bossDefeated ? (
            <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em" }}>
              {Math.max(0, bossWordGoal - bossTotalWords).toLocaleString()}w left to defeat
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4ade80", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Defeated!
            </span>
          )}
        </div>
      </div>

      {/* ── Ground glow separator ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          height: 2, margin: "4px 20px 0",
          background: "linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.5) 25%, rgba(232,121,249,0.5) 50%, rgba(99,102,241,0.5) 75%, transparent 100%)",
          boxShadow: "0 0 12px rgba(180,0,180,0.3)",
        }}
      />

      {/* ── Damage progress info ── */}
      <div
        style={{
          position: "relative", zIndex: 3,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 20px 5px",
          fontSize: "0.62rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.05em",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(168,85,247,0.7)", fontWeight: 700 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {bossTotalWords.toLocaleString()} damage dealt
        </div>
        <span>{bossWordGoal.toLocaleString()} words to slay the boss</span>
      </div>

      {/* ── Word progress bar ── */}
      <div style={{ position: "relative", zIndex: 3, padding: "0 20px 14px" }}>
        <div
          style={{
            height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 99,
            overflow: "hidden", border: "1px solid rgba(168,85,247,0.15)",
          }}
        >
          <motion.div
            style={{
              height: "100%",
              background: bossDefeated
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : "linear-gradient(90deg, #4c1d95, #7c3aed, #a855f7, #c084fc)",
              borderRadius: 99,
            }}
            animate={{
              width: `${progressPercent}%`,
              boxShadow: bossDefeated
                ? ["0 0 8px rgba(34,197,94,0.5)", "0 0 18px rgba(34,197,94,0.8)", "0 0 8px rgba(34,197,94,0.5)"]
                : ["0 0 8px rgba(168,85,247,0.5)", "0 0 18px rgba(168,85,247,0.8)", "0 0 8px rgba(168,85,247,0.5)"],
            }}
            transition={{
              width: { type: "tween", ease: "easeOut", duration: 0.8 },
              boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        </div>
      </div>
    </div>
  );
});
