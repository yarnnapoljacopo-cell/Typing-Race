import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { KartEffect } from "@/hooks/useSprintRoom";

/**
 * Per-lane effect animations.
 *
 * Rendered inside each lane's track area (the same flexbox the kart lives in
 * so `left: ${fraction * 100}%` aligns with cars).
 *
 * The `targetFraction` is the affected participant's current horizontal
 * fraction on the track; `sourceFraction` is the same for whoever fired the
 * item (used for projectiles like shells).
 */
interface KartLaneEffectsProps {
  effects: KartEffect[];
  participantId: string;
  targetFraction: number;
  participantFractions: Map<string, number>;
}

export const KartLaneEffects = memo(function KartLaneEffects({
  effects,
  participantId,
  targetFraction,
  participantFractions,
}: KartLaneEffectsProps) {
  // Pick up only effects that touch THIS lane (either as target, or the source
  // for self-buffs like mushroom/star/golden_pen/mystery_box).
  const relevant = effects.filter((e) => {
    const isTarget = e.targetIds.includes(participantId);
    const isSelfBuff =
      e.sourceId === participantId &&
      (e.item === "mushroom" ||
        e.item === "star" ||
        e.item === "golden_pen" ||
        e.item === "mystery_box" ||
        e.item === "banana" ||
        e.item === "boo");
    return isTarget || isSelfBuff;
  });

  if (relevant.length === 0) return null;

  return (
    <AnimatePresence>
      {relevant.map((e) => {
        const sourceFraction =
          e.sourceId && participantFractions.has(e.sourceId)
            ? participantFractions.get(e.sourceId)!
            : null;
        return (
          <LaneEffect
            key={e.id}
            effect={e}
            participantId={participantId}
            targetFraction={targetFraction}
            sourceFraction={sourceFraction}
          />
        );
      })}
    </AnimatePresence>
  );
});

function LaneEffect({
  effect,
  participantId,
  targetFraction,
  sourceFraction,
}: {
  effect: KartEffect;
  participantId: string;
  targetFraction: number;
  sourceFraction: number | null;
}) {
  const isTarget = effect.targetIds.includes(participantId);
  const isSource = effect.sourceId === participantId;

  switch (effect.item) {
    case "lightning":
      return isTarget ? <LightningStrike fraction={targetFraction} /> : null;
    case "blue_shell":
      return isTarget ? <BlueShellCrash fraction={targetFraction} /> : null;
    case "red_shell":
      return isTarget ? (
        <ShellProjectile
          fromFraction={sourceFraction ?? Math.max(0, targetFraction - 0.25)}
          toFraction={targetFraction}
          color="#ef4444"
          shade="#7f1d1d"
        />
      ) : null;
    case "green_shell":
      return isTarget ? (
        <ShellProjectile
          fromFraction={sourceFraction ?? Math.max(0, targetFraction - 0.25)}
          toFraction={targetFraction}
          color="#22c55e"
          shade="#14532d"
          bouncy
        />
      ) : null;
    case "banana":
      return isSource ? <BananaDrop fraction={targetFraction} /> : null;
    case "star":
      return isSource ? <StarBurst fraction={targetFraction} /> : null;
    case "mushroom":
      return isSource ? <MushroomBoost fraction={targetFraction} /> : null;
    case "boo":
      return isSource ? <BooFloat fraction={targetFraction} /> : isTarget ? <BooFloat fraction={targetFraction} stealing /> : null;
    case "golden_pen":
      return isSource ? <GoldenPenSparkle fraction={targetFraction} /> : null;
    case "mystery_box":
      return isSource ? <MysteryBoxOpen fraction={targetFraction} /> : null;
    default:
      return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Individual lane-level animations                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function LightningStrike({ fraction }: { fraction: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: 0,
        bottom: 0,
        width: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {/* Falling bolt */}
      <motion.svg
        initial={{ y: -240, opacity: 0, scale: 0.5 }}
        animate={{ y: 0, opacity: [0, 1, 1, 0], scale: [0.7, 1.2, 1, 1] }}
        transition={{ duration: 0.55, ease: "easeIn", times: [0, 0.25, 0.7, 1] }}
        width="44"
        height="80"
        viewBox="0 0 44 80"
        style={{
          position: "absolute",
          left: -22,
          top: -32,
          filter: "drop-shadow(0 0 12px #fde047)",
        }}
      >
        <defs>
          <linearGradient id="lit-strike" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="0.55" stopColor="#fde047" />
            <stop offset="1" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <polygon
          points="26,4 10,40 22,40 16,78 36,32 24,32"
          fill="url(#lit-strike)"
          stroke="#3f2d0f"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <polyline
          points="26,8 14,38 22,38"
          fill="none"
          stroke="#fffbe6"
          strokeOpacity="0.9"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>

      {/* Ground shockwave ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.2, 2.4, 3.4] }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.35 }}
        style={{
          position: "absolute",
          left: -28, top: 4,
          width: 56, height: 18,
          borderRadius: "50%",
          border: "3px solid rgba(253,224,71,0.85)",
          boxShadow: "0 0 14px rgba(253,224,71,0.55)",
        }}
      />

      {/* Bright flash dot */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
        transition={{ duration: 0.45, delay: 0.32, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: -16, top: -4,
          width: 32, height: 32,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #ffffff 0%, #fde047 40%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

function BlueShellCrash({ fraction }: { fraction: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: 0, bottom: 0, width: 0,
        zIndex: 51, pointerEvents: "none",
      }}
    >
      {/* Falling blue shell */}
      <motion.svg
        initial={{ y: -260, opacity: 0, rotate: -45 }}
        animate={{
          y: [-260, 0, -4, 0],
          opacity: [0, 1, 1, 1],
          rotate: [-45, 0, 12, 0],
          scale: [0.5, 1.2, 1.05, 1],
        }}
        transition={{ duration: 1.1, times: [0, 0.6, 0.78, 1], ease: "easeIn" }}
        width="48" height="36" viewBox="0 0 48 36"
        style={{
          position: "absolute",
          left: -24, top: -8,
          filter:
            "drop-shadow(0 0 14px rgba(59,130,246,0.75)) drop-shadow(0 0 4px rgba(255,255,255,0.6))",
        }}
      >
        <defs>
          <radialGradient id="bsh-top" cx="0.4" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#dbeafe" />
            <stop offset="0.45" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#1e3a8a" />
          </radialGradient>
        </defs>
        <ellipse cx="24" cy="28" rx="18" ry="5" fill="#fef3c7" stroke="#1e3a8a" strokeWidth="1" />
        <path d="M 6 27 Q 6 8 24 6 Q 42 8 42 27 Z" fill="url(#bsh-top)" stroke="#0f172a" strokeWidth="1.2" />
        <g fill="#0f172a" stroke="#dbeafe" strokeWidth="0.5">
          <polygon points="24,2 22,8 26,8" />
          <polygon points="14,9 12,14 16,14" />
          <polygon points="34,9 32,14 36,14" />
        </g>
        <circle cx="24" cy="20" r="3" fill="#dbeafe" stroke="#0f172a" strokeWidth="0.8" />
      </motion.svg>

      {/* Impact rings */}
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 1, 0], scale: [0.2, 3, 4.5] }}
        transition={{ duration: 0.9, delay: 0.62, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: -36, top: 2,
          width: 72, height: 24,
          borderRadius: "50%",
          border: "3px solid rgba(96,165,250,0.95)",
          boxShadow: "0 0 22px rgba(59,130,246,0.85)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.2, 2, 3.4] }}
        transition={{ duration: 0.8, delay: 0.72, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: -28, top: 4,
          width: 56, height: 18,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.85)",
        }}
      />

      {/* Crash sparks */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * 34,
              y: Math.sin(angle) * 18 + 4,
              scale: [0.4, 1.2, 0.5],
            }}
            transition={{ duration: 0.7, delay: 0.62, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: -2, top: -2,
              width: 4, height: 4,
              borderRadius: "50%",
              background: "#dbeafe",
              boxShadow: "0 0 6px #60a5fa",
            }}
          />
        );
      })}
    </div>
  );
}

function ShellProjectile({
  fromFraction,
  toFraction,
  color,
  shade,
  bouncy,
}: {
  fromFraction: number;
  toFraction: number;
  color: string;
  shade: string;
  bouncy?: boolean;
}) {
  // Animate along a path expressed in % across the track area.
  const span = toFraction - fromFraction;
  const keyframesX = bouncy
    ? [
        `${fromFraction * 100}%`,
        `${(fromFraction + span * 0.33) * 100}%`,
        `${(fromFraction + span * 0.66) * 100}%`,
        `${toFraction * 100}%`,
      ]
    : [`${fromFraction * 100}%`, `${toFraction * 100}%`];
  const keyframesY = bouncy ? [0, -18, -2, 0] : [0, -4, 0];

  return (
    <>
      {/* Shell flies along the lane */}
      <motion.div
        initial={{ left: keyframesX[0], top: "50%", opacity: 1 }}
        animate={{ left: keyframesX, top: ["50%", "50%", "50%", "50%"], y: keyframesY, opacity: [1, 1, 1, 0] }}
        transition={{ duration: 0.85, ease: bouncy ? "easeInOut" : "easeOut", times: bouncy ? [0, 0.3, 0.7, 1] : [0, 0.7, 1] }}
        style={{
          position: "absolute",
          transform: "translate(-50%, -50%)",
          width: 24, height: 18,
          zIndex: 49,
          pointerEvents: "none",
          filter: `drop-shadow(0 0 8px ${color})`,
        }}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 0.3, repeat: 3, ease: "linear" }}
          style={{ width: "100%", height: "100%" }}
        >
          <svg viewBox="0 0 24 18" width="24" height="18">
            <ellipse cx="12" cy="14" rx="9" ry="2.8" fill="#fef3c7" stroke={shade} strokeWidth="0.7" />
            <path d="M 3 13 Q 3 4 12 3 Q 21 4 21 13 Z" fill={color} stroke={shade} strokeWidth="0.9" />
            <circle cx="8" cy="8" r="1.4" fill="#fef3c7" stroke={shade} strokeWidth="0.4" />
            <circle cx="16" cy="8" r="1.4" fill="#fef3c7" stroke={shade} strokeWidth="0.4" />
            <path d="M 5 9 Q 8 5 13 4.5" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Impact burst at the target */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 2.2, 3] }}
        transition={{ duration: 0.55, delay: 0.6, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: `${toFraction * 100}%`,
          top: "50%",
          marginLeft: -22,
          marginTop: -14,
          width: 44, height: 28,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${color} 40%, transparent 75%)`,
          zIndex: 50,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function BananaDrop({ fraction }: { fraction: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, y: -16, rotate: -30 }}
      animate={{ opacity: [0, 1, 1], scale: [0.4, 1.1, 1], y: [-16, 0, 0], rotate: [-30, 12, 0] }}
      transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.7, 1] }}
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: "50%",
        marginTop: -10,
        marginLeft: -12,
        width: 24, height: 20,
        zIndex: 48,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 6px rgba(250,204,21,0.7))",
      }}
    >
      <svg viewBox="0 0 32 32" width="24" height="20">
        <defs>
          <linearGradient id="banana-drop" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fef9c3" />
            <stop offset="0.5" stopColor="#facc15" />
            <stop offset="1" stopColor="#a16207" />
          </linearGradient>
        </defs>
        <path d="M 5 9 Q 4 22 17 26 Q 28 28 27 19 Q 25 22 18 21 Q 9 19 8 9 Z" fill="url(#banana-drop)" stroke="#713f12" strokeWidth="1.2" />
      </svg>
    </motion.div>
  );
}

function StarBurst({ fraction }: { fraction: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: "50%",
        marginTop: -22,
        marginLeft: -22,
        width: 44, height: 44,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {/* Rainbow burst rings */}
      {["#fde047", "#f472b6", "#60a5fa", "#34d399"].map((c, i) => (
        <motion.div
          key={c}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.2, 2.4 + i * 0.2, 3 + i * 0.3] }}
          transition={{ duration: 0.9, delay: i * 0.05, ease: "easeOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${c}`,
            boxShadow: `0 0 14px ${c}`,
          }}
        />
      ))}
      {/* Sparkle particles */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * 36,
              y: Math.sin(angle) * 22,
              scale: [0.5, 1.4, 0.4],
              rotate: [0, 280],
            }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: 20, top: 20,
              width: 6, height: 6,
              borderRadius: "50%",
              background: "#fde047",
              boxShadow: "0 0 8px #fff, 0 0 12px #fde047",
            }}
          />
        );
      })}
    </div>
  );
}

function MushroomBoost({ fraction }: { fraction: number }) {
  return (
    <>
      {/* Trailing flame puffs behind the kart */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6, x: 0 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.4, 1.6], x: -28 - i * 14 }}
          transition={{ duration: 0.85, delay: i * 0.08, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${fraction * 100}%`,
            top: "50%",
            marginLeft: -8 - i * 4,
            marginTop: -6,
            width: 16, height: 12,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #fff7ed 0%, #fb923c 50%, transparent 80%)",
            zIndex: 47,
            pointerEvents: "none",
            filter: "blur(0.5px)",
          }}
        />
      ))}
      {/* Speed lines */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: [0, 0.85, 0], x: -50 }}
          transition={{ duration: 0.55, delay: i * 0.08, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${fraction * 100}%`,
            top: `${30 + i * 8}%`,
            marginLeft: -8,
            width: 24, height: 2,
            background: "linear-gradient(to left, rgba(251,191,36,0.95), transparent)",
            zIndex: 46,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

function BooFloat({ fraction, stealing }: { fraction: number; stealing?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.6 }}
      animate={{
        opacity: [0, 0.95, 0.95, 0],
        y: [-10, -4, -8, -2],
        scale: [0.6, 1.1, 1.05, 0.9],
        rotate: stealing ? [0, -6, 6, 0] : [0, 6, -6, 0],
      }}
      transition={{ duration: 1.8, ease: "easeOut", times: [0, 0.25, 0.7, 1] }}
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: "50%",
        marginLeft: -14,
        marginTop: -18,
        width: 28, height: 28,
        zIndex: 49,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 10px rgba(255,255,255,0.85))",
      }}
    >
      <svg viewBox="0 0 32 32" width="28" height="28">
        <defs>
          <radialGradient id="boo-fx" cx="0.4" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#e5e7eb" />
            <stop offset="1" stopColor="#94a3b8" />
          </radialGradient>
        </defs>
        <path
          d="M 5 14 Q 5 4 16 4 Q 27 4 27 14 L 27 27 Q 24 24 22 27 Q 19 24 16 27 Q 13 24 10 27 Q 8 24 5 27 Z"
          fill="url(#boo-fx)" stroke="#1f2937" strokeWidth="0.9"
        />
        <ellipse cx="12" cy="14" rx="1.7" ry="2.2" fill="#1f2937" />
        <ellipse cx="20" cy="14" rx="1.7" ry="2.2" fill="#1f2937" />
        <ellipse cx="16" cy="19" rx="2.4" ry="1.6" fill="#1f2937" />
      </svg>
    </motion.div>
  );
}

function GoldenPenSparkle({ fraction }: { fraction: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: "50%",
        marginLeft: -28, marginTop: -22,
        width: 56, height: 44,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {/* +400 floating up */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.6 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, -22, -36, -50], scale: [0.6, 1.2, 1, 0.9] }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: "50%", top: 0,
          transform: "translateX(-50%)",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900, fontSize: 14,
          color: "#fffbe6",
          textShadow:
            "0 0 8px #fde047, 0 0 14px #f59e0b, 0 1px 2px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}
      >
        +400 words!
      </motion.div>
      {/* Sparkles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * 36,
              y: Math.sin(angle) * 18 - 6,
              scale: [0.4, 1.6, 0.4],
              rotate: 360,
            }}
            transition={{ duration: 1.6, ease: "easeOut", delay: i * 0.04 }}
            style={{
              position: "absolute",
              left: "50%", top: "50%",
              marginLeft: -2, marginTop: -2,
              width: 4, height: 4,
              background: "#fde047",
              borderRadius: "50%",
              boxShadow: "0 0 6px #fffbe6, 0 0 10px #fde047",
            }}
          />
        );
      })}
    </div>
  );
}

function MysteryBoxOpen({ fraction }: { fraction: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${fraction * 100}%`,
        top: "50%",
        marginLeft: -18, marginTop: -16,
        width: 36, height: 32,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.5, 1.8], rotate: [-10, 8, -4, 0] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0,
          background:
            "radial-gradient(circle, #fde047 0%, #a78bfa 50%, transparent 80%)",
          borderRadius: 8,
          filter: "blur(1px)",
        }}
      />
      {/* Confetti pieces */}
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const colors = ["#fde047", "#f472b6", "#60a5fa", "#34d399", "#a78bfa"];
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * 32,
              y: Math.sin(angle) * 22 - 4,
              rotate: 360,
              scale: [1, 1.2, 0.6],
            }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 + i * 0.02 }}
            style={{
              position: "absolute",
              left: "50%", top: "50%",
              marginLeft: -2, marginTop: -3,
              width: 5, height: 7,
              background: colors[i % colors.length],
              boxShadow: `0 0 4px ${colors[i % colors.length]}`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Track-wide overlay effects (lightning flash, screen shake trigger)        */
/* ──────────────────────────────────────────────────────────────────────── */

interface KartEffectsLayerProps {
  effects: KartEffect[];
}

/** Full-track overlay: lightning white flash, blue-shell red alert. */
export const KartEffectsLayer = memo(function KartEffectsLayer({
  effects,
}: KartEffectsLayerProps) {
  const hasLightning = effects.some((e) => e.item === "lightning");
  const hasBlue = effects.some((e) => e.item === "blue_shell");

  return (
    <>
      <AnimatePresence>
        {hasLightning && (
          <motion.div
            key="lit-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, times: [0, 0.18, 0.5, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(255,255,240,0.95) 0%, rgba(253,224,71,0.45) 40%, transparent 80%)",
              mixBlendMode: "screen",
              pointerEvents: "none",
              zIndex: 60,
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {hasBlue && (
          <motion.div
            key="blue-alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0.2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.55, 0.85, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(59,130,246,0.55) 0%, transparent 80%)",
              mixBlendMode: "screen",
              pointerEvents: "none",
              zIndex: 60,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
});
