import { memo, useRef, type ReactNode } from "react";
import { Participant } from "@/hooks/useSprintRoom";
import { motion, AnimatePresence } from "framer-motion";

const ITEM_BOX_INTERVAL = 250;

interface RaceTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
  durationMinutes: number;
  wordGoal?: number | null;
  reaperWordCount?: number | null;
  carOffsets?: Record<string, number>;
  starActiveIds?: string[];
  isKartMode?: boolean;
  localWordCount?: number;
}

const LANE_COLORS: { car: string; shade: string; light: string }[] = [
  { car: "#3B82F6", shade: "#1D4ED8", light: "#60A5FA" },
  { car: "#e85d3c", shade: "#c0392b", light: "#f87171" },
  { car: "#16a34a", shade: "#15803d", light: "#4ade80" },
  { car: "#d97706", shade: "#b45309", light: "#fbbf24" },
  { car: "#7c3aed", shade: "#6d28d9", light: "#a78bfa" },
  { car: "#0891b2", shade: "#0e7490", light: "#38bdf8" },
];

const CAR_W = 48;

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

function KartIcon({ car, shade, light, laneNum }: { car: string; shade: string; light: string; laneNum: number }) {
  return (
    <svg width="52" height="30" viewBox="0 0 52 30" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.5))" }}>
      <path d="M6 18 Q6 14 10 14 L40 14 Q45 14 46 18 L46 22 Q46 24 44 24 L8 24 Q6 24 6 22 Z" fill={car} />
      <path d="M10 14 L14 10 L36 10 L40 14 Z" fill={shade} />
      <path d="M18 14 L20 9 L30 9 L32 14 Z" fill="rgba(180,220,255,0.7)" />
      <path d="M18 14 L20 9 L30 9 L32 14" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none" />
      <path d="M40 14 L48 17 L46 22 L40 22 Z" fill={shade} />
      <rect x="4" y="11" width="2" height="6" rx="1" fill={shade} />
      <rect x="2" y="10" width="6" height="2" rx="1" fill={light} />
      <path d="M44 18 L50 16 L51 19 L46 21 Z" fill={light} />
      <ellipse cx="14" cy="25" rx="5" ry="4" fill="#111827" />
      <ellipse cx="14" cy="25" rx="3" ry="2.5" fill="#374151" />
      <ellipse cx="14" cy="25" rx="1.2" ry="1" fill="#6B7280" />
      <ellipse cx="38" cy="25" rx="5" ry="4" fill="#111827" />
      <ellipse cx="38" cy="25" rx="3" ry="2.5" fill="#374151" />
      <ellipse cx="38" cy="25" rx="1.2" ry="1" fill="#6B7280" />
      <text x="24" y="20" textAnchor="middle" fontSize="5" fontWeight="900" fill="white"
        fontFamily="DM Sans, sans-serif" opacity="0.9">
        {String(laneNum).padStart(2, "0")}
      </text>
      <path d="M12 15 Q26 13 38 15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="47" cy="18" rx="2" ry="1.5" fill="#FEF08A" opacity="0.9" />
      <ellipse cx="47" cy="18" rx="4" ry="3" fill="rgba(254,240,138,0.2)" />
      <circle cx="5" cy="19" r="1" fill="#F97316" opacity="0.7" />
      <circle cx="3" cy="21" r="0.7" fill="#FBBF24" opacity="0.5" />
    </svg>
  );
}

export const RaceTrack = memo(function RaceTrack({
  participants,
  currentParticipantId,
  durationMinutes,
  wordGoal,
  reaperWordCount,
  carOffsets,
  starActiveIds,
  isKartMode,
  localWordCount,
}: RaceTrackProps) {
  const laneMap = useRef<Map<string, number>>(new Map());
  const nextLane = useRef(0);
  participants.forEach((p) => {
    if (!laneMap.current.has(p.id)) {
      laneMap.current.set(p.id, nextLane.current++);
    }
  });
  const sortedParticipants = [...participants].sort(
    (a, b) => (laneMap.current.get(a.id) ?? 0) - (laneMap.current.get(b.id) ?? 0),
  );

  const target = wordGoal ?? targetWords(durationMinutes);

  const firstPlaceId = isKartMode && participants.length > 0
    ? [...participants].sort((a, b) => {
        const ae = Math.max(0, a.wordCount + (carOffsets?.[a.id] ?? 0));
        const be = Math.max(0, b.wordCount + (carOffsets?.[b.id] ?? 0));
        return be - ae;
      })[0]?.id
    : null;

  const reaperFraction = reaperWordCount != null && reaperWordCount > 0
    ? Math.min(reaperWordCount / target, 1)
    : null;

  if (isKartMode) {
    return (
      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", marginBottom: 2 }}>
        {/* Sky / header */}
        <div style={{ background: "linear-gradient(180deg, #1a1040 0%, #2a1a60 40%, #3a2a20 100%)", padding: "10px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block", animation: "kartTrackPulse 2s ease-in-out infinite" }} />
            Race Track
            {reaperFraction !== null && (
              <span style={{ color: "#f87171", fontSize: "0.65rem", fontWeight: 800, animation: "kartTrackPulse 2s ease-in-out infinite" }}>💀 Death</span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
            goal: {target.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "writer" : "writers"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>
            🏁 Finish
          </div>
        </div>

        {/* Road */}
        <div style={{ background: "linear-gradient(180deg, #2a2035 0%, #1e1830 100%)", position: "relative" }}>
          {/* Top kerb */}
          <div style={{ height: 6, background: "repeating-linear-gradient(90deg, #e53e3e 0px, #e53e3e 18px, white 18px, white 36px)", opacity: 0.85 }} />

          {/* Reaper line */}
          {reaperFraction !== null && (
            <div
              style={{
                position: "absolute",
                top: 6,
                bottom: 6,
                zIndex: 25,
                left: `calc(30px + ${reaperFraction * 100}% * (100% - 62px) / 100%)`,
                width: 3,
                background: "repeating-linear-gradient(to bottom, #ef4444 0px, #ef4444 8px, #7f1d1d 8px, #7f1d1d 16px)",
                boxShadow: "0 0 8px 2px rgba(239,68,68,0.5)",
                pointerEvents: "none",
              }}
            />
          )}

          {sortedParticipants.length === 0 ? (
            <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", fontSize: "0.875rem", fontStyle: "italic" }}>
              Waiting for participants to join...
            </div>
          ) : (
            sortedParticipants.map((p) => {
              const laneIndex = laneMap.current.get(p.id) ?? 0;
              const colors = LANE_COLORS[laneIndex % LANE_COLORS.length];
              const isMe = p.id === currentParticipantId;

              const displayWordCount = isMe && localWordCount !== undefined
                ? Math.max(p.wordCount, localWordCount)
                : p.wordCount;
              const effectiveWordCount = Math.max(0, displayWordCount + (carOffsets?.[p.id] ?? 0));
              const fraction = Math.min(effectiveWordCount / target, 1);
              const finished = effectiveWordCount >= target;
              const eliminated = reaperWordCount != null && displayWordCount < reaperWordCount && !finished;
              const hasStarActive = starActiveIds?.includes(p.id) ?? false;
              const isFirstPlace = firstPlaceId === p.id;

              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center",
                  padding: "10px 16px",
                  gap: 10,
                  position: "relative",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  opacity: eliminated ? 0.55 : 1,
                  transition: "opacity 0.4s",
                }}>
                  {/* Lane number */}
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.2)", minWidth: 14, fontFamily: "monospace" }}>
                    {laneIndex + 1}
                  </span>

                  {/* Lane track */}
                  <div style={{ flex: 1, height: 48, position: "relative", display: "flex", alignItems: "center" }}>
                    {/* Centre dashes */}
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", borderTop: "2px dashed rgba(255,255,255,0.12)" }} />

                    {/* Speed lines behind kart (decorative) */}
                    <svg style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 55, height: 30, pointerEvents: "none", zIndex: 1 }} viewBox="0 0 55 30" fill="none">
                      <line x1="50" y1="10" x2="8" y2="10" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="50" y1="15" x2="2" y2="15" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="50" y1="20" x2="8" y2="20" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>

                    {/* Track area for positioning */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 16 }}>
                      {/* Item boxes */}
                      {!eliminated && !finished && (() => {
                        const nextBox = (Math.floor(displayWordCount / ITEM_BOX_INTERVAL) + 1) * ITEM_BOX_INTERVAL;
                        const boxes: ReactNode[] = [];
                        for (let box = nextBox; box < target && boxes.length < 3; box += ITEM_BOX_INTERVAL) {
                          const boxFraction = Math.min(box / target, 1);
                          boxes.push(
                            <div
                              key={box}
                              style={{
                                position: "absolute",
                                left: `${boxFraction * 100}%`,
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                width: 22, height: 22,
                                borderRadius: 4,
                                background: "linear-gradient(135deg, #f6c90e 0%, #e8a500 100%)",
                                border: "2px solid rgba(255,255,255,0.6)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.7rem", fontWeight: 900, color: "rgba(255,255,255,0.9)",
                                boxShadow: "0 0 10px rgba(246,201,14,0.6), 0 2px 6px rgba(0,0,0,0.3)",
                                zIndex: 2,
                                pointerEvents: "none",
                              }}
                            >
                              ?
                            </div>
                          );
                        }
                        return boxes;
                      })()}

                      {/* Kart with motion */}
                      <motion.div
                        style={{ position: "absolute", top: "50%", willChange: "left", zIndex: 3 }}
                        animate={{ left: `${fraction * 100}%` }}
                        transition={{ type: "tween", ease: "easeOut", duration: 0.6 }}
                      >
                        <div style={{ transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          {/* Crown for 1st place */}
                          {isFirstPlace && !finished && (
                            <div style={{ fontSize: "0.875rem", lineHeight: 1, pointerEvents: "none", textShadow: "0 0 6px #fbbf24" }}>
                              👑
                            </div>
                          )}

                          {/* Name / word count badge */}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 4,
                            background: eliminated ? "rgba(60,60,60,0.85)" : isMe ? "linear-gradient(135deg, #fff 0%, #f0edff 100%)" : "rgba(255,255,255,0.9)",
                            borderRadius: 5, padding: "2px 7px",
                            fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.05em",
                            whiteSpace: "nowrap",
                            boxShadow: eliminated ? "0 0 0 2px #ef4444" : finished ? "0 0 0 2px #fbbf24" : isMe ? `0 0 0 1.5px ${colors.car}` : "0 2px 8px rgba(0,0,0,0.3)",
                            border: isMe ? "1px solid rgba(107,143,212,0.3)" : "none",
                            color: eliminated ? "#fca5a5" : finished ? "#92400e" : "#1a1a2e",
                          }}>
                            {eliminated ? "💀 " : finished ? "🏁 " : ""}{isMe ? "You" : p.name}
                            <span style={{ fontFamily: "monospace", color: eliminated ? "#f87171" : "#6B8FD4", marginLeft: 2 }}>
                              · {isKartMode ? effectiveWordCount : displayWordCount}w
                            </span>
                          </div>

                          {/* Kart SVG */}
                          <motion.div
                            animate={finished
                              ? { scale: [1, 1.08, 1] }
                              : { y: [0, -1.5, 0, 1, 0] }
                            }
                            transition={finished
                              ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                              : { repeat: Infinity, duration: 1.4, ease: "easeInOut" }
                            }
                            style={{
                              opacity: eliminated ? 0.4 : 1,
                              filter: hasStarActive
                                ? "drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 10px #fde047)"
                                : undefined,
                            }}
                          >
                            <KartIcon
                              car={eliminated ? "#6b7280" : finished ? "#fbbf24" : colors.car}
                              shade={eliminated ? "#4b5563" : finished ? "#d97706" : colors.shade}
                              light={eliminated ? "#9ca3af" : finished ? "#fcd34d" : colors.light}
                              laneNum={laneIndex + 1}
                            />
                          </motion.div>
                        </div>
                      </motion.div>
                    </div>

                    {/* Finish line */}
                    <div style={{
                      position: "absolute", right: 0, top: 0, bottom: 0, width: 16,
                      background: "repeating-linear-gradient(180deg, white 0px, white 5px, #111 5px, #111 10px)",
                      opacity: 0.75,
                      borderRadius: "0 2px 2px 0",
                      boxShadow: "-2px 0 8px rgba(0,0,0,0.3)",
                    }} />

                    {/* "Goal reached" ribbon */}
                    <AnimatePresence>
                      {finished && (
                        <motion.div
                          key="ribbon"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", fontSize: "0.625rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fbbf24", textShadow: "0 1px 4px rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}
                        >
                          You're on fire! 🔥
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom kerb */}
          <div style={{ height: 6, background: "repeating-linear-gradient(90deg, #2b6cb0 0px, #2b6cb0 18px, white 18px, white 36px)", opacity: 0.85 }} />
        </div>
      </div>
    );
  }

  // ── Regular (non-kart) race track ──────────────────────────────────────
  return (
    <div className="w-full rounded-xl overflow-hidden shadow-sm border" style={{ background: "#2d4a1e" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          Race Track
          {reaperFraction !== null && (
            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">💀 Death</span>
          )}
        </span>
        <span className="text-white/50 text-xs font-mono">
          goal: {target.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "writer" : "writers"}
        </span>
      </div>

      <div className="relative">
        <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: "56px", width: "4px", background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.65) 0px, rgba(255,255,255,0.65) 6px, rgba(0,0,0,0.55) 6px, rgba(0,0,0,0.55) 12px)" }} />
        <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ right: "16px", width: "5px", background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 6px, rgba(0,0,0,0.7) 6px, rgba(0,0,0,0.7) 12px)" }}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold whitespace-nowrap" style={{ opacity: 0.8 }}>FINISH</div>
        </div>

        {reaperFraction !== null && (
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ zIndex: 25, left: `calc(${59}px + ${(reaperFraction * 100).toFixed(3)}% - ${(reaperFraction * (16 + 48 + 59)).toFixed(3)}px)`, width: "3px", background: "repeating-linear-gradient(to bottom, #ef4444 0px, #ef4444 8px, #7f1d1d 8px, #7f1d1d 16px)", boxShadow: "0 0 8px 2px rgba(239,68,68,0.5)" }}>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap" style={{ color: "#ef4444", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>💀</div>
          </div>
        )}

        <div className="flex flex-col gap-0">
          {sortedParticipants.length === 0 ? (
            <div className="h-16 flex items-center justify-center text-white/40 text-sm italic" style={{ background: "#3a5c28" }}>
              Waiting for participants to join...
            </div>
          ) : (
            sortedParticipants.map((p) => {
              const laneIndex = laneMap.current.get(p.id) ?? 0;
              const colors = LANE_COLORS[laneIndex % LANE_COLORS.length];
              const isMe = p.id === currentParticipantId;
              const displayWordCount = isMe && localWordCount !== undefined ? Math.max(p.wordCount, localWordCount) : p.wordCount;
              const effectiveWordCount = Math.max(0, displayWordCount + (carOffsets?.[p.id] ?? 0));
              const fraction = Math.min(effectiveWordCount / target, 1);
              const finished = effectiveWordCount >= target;
              const eliminated = reaperWordCount != null && displayWordCount < reaperWordCount && !finished;
              const hasStarActive = starActiveIds?.includes(p.id) ?? false;
              const isFirstPlace = firstPlaceId === p.id;

              return (
                <div key={p.id} className="relative" style={{ height: "64px", background: eliminated ? "rgba(239,68,68,0.08)" : finished ? "rgba(255,255,255,0.08)" : laneIndex % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.10)", borderBottom: eliminated ? "1px solid rgba(239,68,68,0.18)" : "1px solid rgba(255,255,255,0.06)", opacity: eliminated ? 0.55 : 1, transition: "background 0.4s, opacity 0.4s" }}>
                  <div className="absolute top-1/2 -translate-y-1/2 left-14 right-6 pointer-events-none" style={{ height: "2px", background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 12px, transparent 12px, transparent 24px)" }} />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold font-mono" style={{ width: "20px", textAlign: "center" }}>{laneIndex + 1}</div>

                  <div className="absolute top-0 bottom-0" style={{ left: "59px", right: `${16 + CAR_W}px` }}>
                    {!eliminated && !finished && (() => {
                      const nextBox = (Math.floor(displayWordCount / ITEM_BOX_INTERVAL) + 1) * ITEM_BOX_INTERVAL;
                      const boxes: ReactNode[] = [];
                      for (let box = nextBox; box < target && boxes.length < 3; box += ITEM_BOX_INTERVAL) {
                        const boxFraction = Math.min(box / target, 1);
                        boxes.push(
                          <div key={box} className="absolute top-1/2 z-10 pointer-events-none" style={{ left: `${boxFraction * 100}%`, transform: "translate(-50%, -50%)" }}>
                            <div className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-black leading-none" style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", border: "1.5px solid #fde68a", color: "#78350f", boxShadow: "0 0 5px rgba(251,191,36,0.6)" }}>?</div>
                          </div>
                        );
                      }
                      return boxes;
                    })()}

                    <motion.div className="absolute top-0 bottom-0 flex flex-col items-center justify-center" animate={{ left: `${fraction * 100}%` }} transition={{ type: "tween", ease: "easeOut", duration: 0.6 }} style={{ willChange: "left" }}>
                      <div className="flex items-center gap-1 mb-0.5 whitespace-nowrap" style={{ background: eliminated ? "rgba(60,60,60,0.85)" : isMe ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)", borderRadius: "4px", padding: "1px 6px", boxShadow: eliminated ? "0 0 0 2px #ef4444" : finished ? "0 0 0 2px #fbbf24" : isMe ? `0 0 0 2px ${colors.car}` : "none" }}>
                        <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: eliminated ? "#fca5a5" : finished ? "#92400e" : colors.shade }}>{eliminated ? "💀" : finished ? "🏁" : ""}{isMe ? "You" : p.name}</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: eliminated ? "#f87171" : "#374151" }}>{displayWordCount}w</span>
                      </div>

                      {isFirstPlace && isKartMode && !finished && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm leading-none pointer-events-none" style={{ textShadow: "0 0 6px #fbbf24" }}>👑</div>
                      )}

                      <motion.div animate={finished ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={finished ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } : {}} style={{ opacity: eliminated ? 0.4 : 1, filter: hasStarActive ? "drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 10px #fde047)" : undefined }}>
                        <CarIcon color={eliminated ? "#6b7280" : finished ? "#fbbf24" : colors.car} />
                      </motion.div>
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {finished && (
                      <motion.div key="ribbon" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#fbbf24", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
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
