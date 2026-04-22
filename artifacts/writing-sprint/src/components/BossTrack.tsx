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
  "#e85d3c",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

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
      {/* Head */}
      <circle cx="12" cy="5" r="4" fill={color} />
      {/* Body */}
      <rect x="9" y="10" width="6" height="10" rx="2" fill={color} />
      {/* Left arm (raised for attack) */}
      <motion.line
        x1="9" y1="13" x2="3" y2={attacking ? "8" : "16"}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        animate={attacking ? { y2: [16, 8, 16] } : {}}
        transition={attacking ? { repeat: Infinity, duration: 0.5 } : {}}
      />
      {/* Right arm */}
      <line x1="15" y1="13" x2="21" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Left leg */}
      <line x1="10" y1="20" x2="8" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Right leg */}
      <line x1="14" y1="20" x2="16" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Sword */}
      {attacking && (
        <line x1="3" y1="8" x2="-3" y2="2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      )}
    </motion.svg>
  );
}

function BossMonster({ healthPercent, defeated }: { healthPercent: number; defeated: boolean }) {
  const eyeColor = defeated ? "#6b7280" : healthPercent < 25 ? "#ef4444" : "#1a1a1a";

  return (
    <motion.div
      className="relative flex-shrink-0"
      animate={defeated ? { scale: [1, 0.8], opacity: [1, 0] } : { x: [0, -2, 2, -2, 0] }}
      transition={
        defeated
          ? { duration: 1.5, ease: "easeOut" }
          : { repeat: Infinity, duration: 3, ease: "easeInOut" }
      }
    >
      <svg viewBox="0 0 80 90" width="80" height="90" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="40" cy="55" rx="28" ry="32" fill={defeated ? "#374151" : "#1e1b4b"} />
        {/* Head */}
        <ellipse cx="40" cy="28" rx="22" ry="20" fill={defeated ? "#4b5563" : "#312e81"} />
        {/* Horns */}
        <polygon points="22,16 16,2 28,12" fill={defeated ? "#4b5563" : "#4c1d95"} />
        <polygon points="58,16 64,2 52,12" fill={defeated ? "#4b5563" : "#4c1d95"} />
        {/* Eyes */}
        <circle cx="33" cy="26" r="5" fill="white" />
        <circle cx="47" cy="26" r="5" fill="white" />
        <motion.circle
          cx="33" cy="26" r="3"
          fill={eyeColor}
          animate={defeated ? {} : { cy: [26, 28, 26] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <motion.circle
          cx="47" cy="26" r="3"
          fill={eyeColor}
          animate={defeated ? {} : { cy: [26, 28, 26] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        {/* Mouth */}
        {!defeated ? (
          <path d="M30 36 Q40 43 50 36" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M30 40 Q40 35 50 40" stroke="#6b7280" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {/* Claws */}
        <path d="M12 60 L6 54 L10 68" stroke={defeated ? "#4b5563" : "#4c1d95"} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M68 60 L74 54 L70 68" stroke={defeated ? "#4b5563" : "#4c1d95"} strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Damage slash when low health */}
        {!defeated && healthPercent < 40 && (
          <>
            <line x1="25" y1="20" x2="38" y2="35" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="42" y1="20" x2="55" y2="32" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          </>
        )}
      </svg>
      {/* Damage numbers floating up */}
      {!defeated && healthPercent < 100 && (
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2 text-red-400 font-bold text-xs pointer-events-none"
          animate={{ y: [-0, -20], opacity: [1, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
        >
          -{Math.floor(Math.random() * 50 + 10)}
        </motion.div>
      )}
    </motion.div>
  );
}

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

  return (
    <div className="w-full rounded-xl overflow-hidden shadow-sm border" style={{ background: "#0f0a1a" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-purple-300 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          ⚔️ Boss Battle
        </span>
        <span className="text-white/50 text-xs font-mono">
          {bossTotalWords.toLocaleString()} / {bossWordGoal.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "fighter" : "fighters"}
        </span>
      </div>

      {/* Boss health bar */}
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
        {/* Fighters (left side) */}
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
                  {/* Figure */}
                  <FigureIcon color={color} attacking={p.wordCount > 0 && !bossDefeated} />

                  {/* Name + stats */}
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
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${contribution}%`, background: color }}
                          />
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

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1 self-center px-2">
          {/* Slash effects */}
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

        {/* Boss (right side) */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <BossMonster healthPercent={healthPercent} defeated={bossDefeated} />
          {bossDefeated ? (
            <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Defeated!</span>
          ) : (
            <span className="text-xs font-mono text-red-300">
              {Math.max(0, bossWordGoal - bossTotalWords).toLocaleString()}w left
            </span>
          )}
        </div>
      </div>

      {/* Progress bar at the bottom */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: bossDefeated
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : "linear-gradient(90deg, #7c3aed, #a855f7)",
              boxShadow: bossDefeated ? "0 0 8px rgba(34,197,94,0.5)" : "0 0 8px rgba(168,85,247,0.4)",
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
