import { memo, useRef } from "react";
import { Participant } from "@/hooks/useSprintRoom";
import { motion, AnimatePresence } from "framer-motion";

interface RaceTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
  durationMinutes: number;
  wordGoal?: number | null;
}

const LANE_COLORS: { car: string; text: string }[] = [
  { car: "#e85d3c", text: "#c0392b" },
  { car: "#2563eb", text: "#1e40af" },
  { car: "#16a34a", text: "#15803d" },
  { car: "#d97706", text: "#b45309" },
  { car: "#7c3aed", text: "#6d28d9" },
  { car: "#0891b2", text: "#0e7490" },
];

const CAR_W = 48;

// Words needed to reach the finish line.
function targetWords(durationMinutes: number) {
  if (durationMinutes <= 30) return 2000;
  if (durationMinutes <= 45) return 2500;
  return 3500;
}

function CarIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 24" width={CAR_W} height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="40" height="12" rx="3" fill={color} />
      <path d="M12 8 L16 2 L32 2 L36 8 Z" fill={color} opacity="0.85" />
      <path d="M17 8 L19 4 L29 4 L31 8 Z" fill="white" opacity="0.5" />
      <circle cx="36" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="36" cy="20" r="2" fill="#666" />
      <circle cx="12" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="12" cy="20" r="2" fill="#666" />
      <rect x="42" y="11" width="3" height="4" rx="1" fill="#fde68a" />
      <rect x="3" y="11" width="3" height="4" rx="1" fill="#fca5a5" />
    </svg>
  );
}

export const RaceTrack = memo(function RaceTrack({
  participants,
  currentParticipantId,
  durationMinutes,
  wordGoal,
}: RaceTrackProps) {
  // ── Stable lane assignments ───────────────────────────────────────────
  // We lock each participant to a lane index the first time we see them.
  // Disconnections never shift other participants' colours or numbers.
  const laneMap = useRef<Map<string, number>>(new Map());
  const nextLane = useRef(0);
  participants.forEach((p) => {
    if (!laneMap.current.has(p.id)) {
      laneMap.current.set(p.id, nextLane.current++);
    }
  });
  // Sort by the stable lane index so positions never shuffle
  const sortedParticipants = [...participants].sort(
    (a, b) => (laneMap.current.get(a.id) ?? 0) - (laneMap.current.get(b.id) ?? 0),
  );

  const target = wordGoal ?? targetWords(durationMinutes);

  return (
    <div className="w-full rounded-xl overflow-hidden shadow-sm border" style={{ background: "#2d4a1e" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Race Track</span>
        <span className="text-white/50 text-xs font-mono">
          goal: {target} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "writer" : "writers"}
        </span>
      </div>

      <div className="relative">
        {/* Start line — repeating gradient fills any track height */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{
            left: "56px",
            width: "4px",
            background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.65) 0px, rgba(255,255,255,0.65) 6px, rgba(0,0,0,0.55) 6px, rgba(0,0,0,0.55) 12px)",
          }}
        />

        {/* Finish line — repeating gradient fills any track height */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{
            right: "16px",
            width: "5px",
            background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 6px, rgba(0,0,0,0.7) 6px, rgba(0,0,0,0.7) 12px)",
          }}
        >
          <div
            className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold whitespace-nowrap"
            style={{ opacity: 0.8 }}
          >
            FINISH
          </div>
        </div>

        {/* Lanes */}
        <div className="flex flex-col gap-0">
          {sortedParticipants.length === 0 ? (
            <div
              className="h-16 flex items-center justify-center text-white/40 text-sm italic"
              style={{ background: "#3a5c28" }}
            >
              Waiting for participants to join...
            </div>
          ) : (
            sortedParticipants.map((p) => {
              // Use stable lane index — never changes even if others disconnect
              const laneIndex = laneMap.current.get(p.id) ?? 0;
              const colors = LANE_COLORS[laneIndex % LANE_COLORS.length];
              const isMe = p.id === currentParticipantId;

              // Absolute fraction: progress toward the fixed word-count target.
              const fraction = Math.min(p.wordCount / target, 1);
              const finished = p.wordCount >= target;

              return (
                <div
                  key={p.id}
                  className="relative"
                  style={{
                    height: "64px",
                    background: finished
                      ? "rgba(255,255,255,0.08)"
                      : laneIndex % 2 === 0
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.10)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    transition: "background 0.4s",
                  }}
                >
                  {/* Dashed centre line */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-14 right-6 pointer-events-none"
                    style={{
                      height: "2px",
                      background:
                        "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 12px, transparent 12px, transparent 24px)",
                    }}
                  />

                  {/* Lane number */}
                  <div
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold font-mono"
                    style={{ width: "20px", textAlign: "center" }}
                  >
                    {laneIndex + 1}
                  </div>

                  {/*
                    Track area: left edge = just past start line (59px),
                    right edge = finish line minus car width so car stops AT the line.
                    `left` as % of this wrapper = true proportional progress.
                  */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: "59px", right: `${16 + CAR_W}px` }}
                  >
                    <motion.div
                      className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
                      animate={{ left: `${fraction * 100}%` }}
                      transition={{ type: "tween", ease: "easeOut", duration: 0.6 }}
                      style={{ willChange: "left" }}
                    >
                      {/* Name + word count badge */}
                      <div
                        className="flex items-center gap-1 mb-0.5 whitespace-nowrap"
                        style={{
                          background: isMe ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          boxShadow: finished
                            ? `0 0 0 2px #fbbf24`
                            : isMe
                            ? `0 0 0 2px ${colors.car}`
                            : "none",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold truncate max-w-[60px]"
                          style={{ color: finished ? "#92400e" : colors.text }}
                        >
                          {finished ? "🏁" : ""}{isMe ? "You" : p.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: "#374151" }}>
                          {p.wordCount}w
                        </span>
                      </div>

                      {/* Car — pulses when finished */}
                      <motion.div
                        animate={finished ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={finished ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : {}}
                      >
                        <CarIcon color={finished ? "#fbbf24" : colors.car} />
                      </motion.div>
                    </motion.div>
                  </div>

                  {/* "Goal reached!" ribbon that slides in from the right */}
                  <AnimatePresence>
                    {finished && (
                      <motion.div
                        key="ribbon"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "#fbbf24", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                      >
                        You're on fire! 🔥
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
