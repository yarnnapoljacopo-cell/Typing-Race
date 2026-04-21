import { memo } from "react";
import { Participant } from "@/hooks/useSprintRoom";
import { motion } from "framer-motion";

interface RaceTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
}

const LANE_COLORS: { car: string; lane: string; text: string }[] = [
  { car: "#e85d3c", lane: "#fde8e4", text: "#c0392b" },
  { car: "#2563eb", lane: "#e0eaff", text: "#1e40af" },
  { car: "#16a34a", lane: "#dcfce7", text: "#15803d" },
  { car: "#d97706", lane: "#fef3c7", text: "#b45309" },
  { car: "#7c3aed", lane: "#ede9fe", text: "#6d28d9" },
  { car: "#0891b2", lane: "#cffafe", text: "#0e7490" },
];

function CarIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 48 24"
      width="48"
      height="24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <rect x="4" y="8" width="40" height="12" rx="3" fill={color} />
      {/* Roof */}
      <path d="M12 8 L16 2 L32 2 L36 8 Z" fill={color} opacity="0.85" />
      {/* Windows */}
      <path d="M17 8 L19 4 L29 4 L31 8 Z" fill="white" opacity="0.5" />
      {/* Front wheel */}
      <circle cx="36" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="36" cy="20" r="2" fill="#666" />
      {/* Rear wheel */}
      <circle cx="12" cy="20" r="4" fill="#1a1a1a" />
      <circle cx="12" cy="20" r="2" fill="#666" />
      {/* Headlight */}
      <rect x="42" y="11" width="3" height="4" rx="1" fill="#fde68a" />
      {/* Taillight */}
      <rect x="3" y="11" width="3" height="4" rx="1" fill="#fca5a5" />
    </svg>
  );
}

export const RaceTrack = memo(function RaceTrack({
  participants,
  currentParticipantId,
}: RaceTrackProps) {
  const sortedParticipants = [...participants].sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  const maxWords = Math.max(...participants.map((p) => p.wordCount), 1);

  return (
    <div
      className="w-full rounded-xl overflow-hidden shadow-sm border"
      style={{ background: "#2d4a1e" }}
    >
      {/* Track header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
          Race Track
        </span>
        <span className="text-white/50 text-xs font-mono">
          {participants.length} {participants.length === 1 ? "writer" : "writers"}
        </span>
      </div>

      <div className="relative">
        {/* Start line */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{ left: "52px", width: "3px" }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: "6px",
                background: i % 2 === 0 ? "white" : "black",
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        {/* Finish line */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{ right: "16px", width: "4px" }}
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: "6px",
                background: i % 2 === 0 ? "white" : "black",
                opacity: 0.85,
              }}
            />
          ))}
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
            sortedParticipants.map((p, i) => {
              const colors = LANE_COLORS[i % LANE_COLORS.length];
              const isMe = p.id === currentParticipantId;

              // Progress 0–90% of available track width
              // Track: from ~60px to finish (right:16px), usable width
              // We represent as percentage of (totalWidth - leftPad - rightPad)
              const progress =
                maxWords <= 1 ? 0 : Math.min((p.wordCount / maxWords) * 88, 88);

              return (
                <div
                  key={p.id}
                  className="relative"
                  style={{
                    height: "64px",
                    background:
                      i % 2 === 0
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.10)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Asphalt texture line */}
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
                    {i + 1}
                  </div>

                  {/* Car + label block */}
                  <motion.div
                    className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
                    style={{ left: "56px" }}
                    animate={{ x: `${progress}%` }}
                    transition={{
                      type: "tween",
                      ease: "easeOut",
                      duration: 1.8,
                    }}
                  >
                    {/* Name + word count label above */}
                    <div
                      className="flex items-center gap-1 mb-0.5 whitespace-nowrap"
                      style={{
                        background: isMe
                          ? "rgba(255,255,255,0.95)"
                          : "rgba(255,255,255,0.75)",
                        borderRadius: "4px",
                        padding: "1px 6px",
                        boxShadow: isMe
                          ? `0 0 0 2px ${colors.car}`
                          : "none",
                      }}
                    >
                      <span
                        className="text-[10px] font-bold truncate max-w-[60px]"
                        style={{ color: colors.text }}
                      >
                        {isMe ? "You" : p.name}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold"
                        style={{ color: "#374151" }}
                      >
                        {p.wordCount}w
                      </span>
                    </div>

                    {/* Car */}
                    <CarIcon color={colors.car} />
                  </motion.div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});
