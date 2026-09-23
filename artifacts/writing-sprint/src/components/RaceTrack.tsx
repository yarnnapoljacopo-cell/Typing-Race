import { memo, useRef, useEffect, useState, type ReactNode } from "react";
import { Participant, type KartEffect } from "@/hooks/useSprintRoom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SkinnedCar, SkinnedKart, getRoadStyle, shouldApplySkins } from "@/lib/skinCatalog";
import { KartEffectsLayer, KartLaneEffects } from "@/components/KartEffects";

import { RoadCar, RaceKart } from "@/lib/raceVehicles";
import "./race-polish.css";

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
  hostCarSkin?: string | null;
  hostRoadSkin?: string | null;
  roomMode?: string | null;
  kartEffects?: KartEffect[];
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

/** Each vehicle has a fixed-width anchor, so labels never shift the car.
 * Animate a full-width rail with transforms: percent positions still use the
 * existing track width, while car movement avoids layout work on every frame. */
function RacerPosition({ fraction, kart = false, children }: { fraction: number; kart?: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const previous = useRef(fraction);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    if (previous.current === fraction) return;
    previous.current = fraction;
    setMoving(true);
    const timer = setTimeout(() => setMoving(false), 700);
    return () => clearTimeout(timer);
  }, [fraction]);
  return <motion.div className={`racer-position${moving ? " race-moving" : ""}`} initial={false}
    animate={{ x: `${fraction * 100}%` }} transition={reducedMotion ? { duration: 0 } : { type: "spring", duration: .55, bounce: 0 }}
    style={{ position: "absolute", left: 0, width: "100%", top: kart ? "50%" : 0, bottom: kart ? undefined : 0, zIndex: kart ? 3 : undefined, pointerEvents: "none" }}>
    <div className="racer-anchor" style={kart ? { width: "max-content" } : { position: "absolute", top: 0, bottom: 0, width: CAR_W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
  </motion.div>;
}

export const RaceTrack = memo(function RaceTrack({
  participants: rawParticipants,
  currentParticipantId,
  durationMinutes,
  wordGoal,
  reaperWordCount,
  carOffsets,
  starActiveIds,
  isKartMode,
  localWordCount,
  hostCarSkin,
  hostRoadSkin,
  roomMode,
  kartEffects,
}: RaceTrackProps) {
  const reducedMotion = useReducedMotion();
  // Editors are visible non-racers — they appear in the writers list with
  // a badge but don't get a car on the track.
  const participants = rawParticipants.filter((p) => p.role !== "editor");
  const skinsActive = shouldApplySkins(roomMode);
  const activeCarSkin = skinsActive ? (hostCarSkin ?? null) : null;
  const activeRoadSkin = skinsActive ? (hostRoadSkin ?? null) : null;
  const roadStyle = getRoadStyle(activeRoadSkin);
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

  const hasGoal = wordGoal != null && wordGoal > 0;
  const displayWords = (p: Participant) => p.id === currentParticipantId && localWordCount !== undefined
    ? Math.max(0, localWordCount)
    : p.wordCount;
  // Timed/open rooms use an expanding scale, not an artificial finish line.
  const target = hasGoal ? wordGoal : Math.max(
    targetWords(durationMinutes),
    Math.ceil(Math.max(0, reaperWordCount ?? 0, ...participants.map((p) =>
      Math.max(0, displayWords(p) + (carOffsets?.[p.id] ?? 0)),
    )) / 500) * 500,
  );

  const firstPlaceId = isKartMode && participants.length > 0
    ? [...participants].sort((a, b) => {
        const ae = Math.max(0, displayWords(a) + (carOffsets?.[a.id] ?? 0));
        const be = Math.max(0, displayWords(b) + (carOffsets?.[b.id] ?? 0));
        return be - ae;
      })[0]?.id
    : null;

  const reaperFraction = reaperWordCount != null && reaperWordCount > 0
    ? Math.min(reaperWordCount / target, 1)
    : null;

  // Pre-compute every participant's current track fraction so per-lane effects
  // can use it (e.g. source position for shell projectiles).
  const participantFractions = new Map<string, number>();
  if (isKartMode) {
    participants.forEach((p) => {
      const isMe = p.id === currentParticipantId;
      const display = isMe && localWordCount !== undefined ? Math.max(0, localWordCount) : p.wordCount;
      const eff = Math.max(0, display + (carOffsets?.[p.id] ?? 0));
      participantFractions.set(p.id, Math.min(eff / target, 1));
    });
  }
  const activeEffects = kartEffects ?? [];
  const hasLightning = activeEffects.some((e) => e.item === "lightning");
  const hasBlueShell = activeEffects.some((e) => e.item === "blue_shell");

  if (isKartMode) {
    return (
      <motion.div
        className="race-track race-track-kart"
        initial={false}
        animate={
          reducedMotion ? { x: 0, y: 0 } : hasLightning
            ? { x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, 2, -2, 1, -1, 0] }
            : hasBlueShell
              ? { x: [0, -3, 3, -2, 2, 0] }
              : { x: 0, y: 0 }
        }
        transition={{ duration: hasLightning ? 0.6 : 0.5, ease: "easeOut" }}
        style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", marginBottom: 2 }}
      >
        {/* Sky / header */}
        <div className="race-track-heading" style={{ background: roadStyle.kartSky, padding: "6px 12px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block", animation: "kartTrackPulse 2s ease-in-out infinite" }} />
            Race Track
            {reaperFraction !== null && (
              <span style={{ color: "#f87171", fontSize: "0.65rem", fontWeight: 800, animation: "kartTrackPulse 2s ease-in-out infinite" }}>💀 Death</span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
            {hasGoal ? "goal" : "scale"}: {target.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "writer" : "writers"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>
            {hasGoal ? "🏁 Finish" : "Distance"}
          </div>
        </div>

        {/* Road */}
        <div className="race-road" style={{ background: roadStyle.kartRoad, position: "relative" }}>
          {/* Top kerb */}
          <div style={{ height: 6, background: roadStyle.topKerb, opacity: 0.85 }} />

          {/* Reaper line */}
          {reaperFraction !== null && (
            <div
              style={{
                position: "absolute",
                top: 6,
                bottom: 6,
                zIndex: 25,
                left: `calc(${reaperFraction * 100}% + ${30 - 62 * reaperFraction}px)`,
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
                ? Math.max(0, localWordCount)
                : p.wordCount;
              const effectiveWordCount = Math.max(0, displayWordCount + (carOffsets?.[p.id] ?? 0));
              const fraction = Math.min(effectiveWordCount / target, 1);
              const finished = hasGoal && displayWordCount >= target;
              const eliminated = reaperWordCount != null && displayWordCount < reaperWordCount && !finished;
              const hasStarActive = starActiveIds?.includes(p.id) ?? false;
              const isFirstPlace = firstPlaceId === p.id;
              const isBeingHit = activeEffects.some(
                (e) =>
                  e.targetIds.includes(p.id) &&
                  (e.effect === "car_subtract" || e.effect === "bold_text" || e.effect === "blur_counter"),
              );
              const lastHitId = activeEffects.find((e) => e.targetIds.includes(p.id) && (e.effect === "car_subtract" || e.effect === "bold_text" || e.effect === "blur_counter"))?.id;

              return (
                <div key={p.id} className="race-lane" style={{
                  display: "flex", alignItems: "center",
                  padding: "6px 16px",
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
                  <div style={{ flex: 1, height: 38, position: "relative", display: "flex", alignItems: "center" }}>
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
                      {/* Item boxes — fill the entire track at 250-word intervals; popped after being passed */}
                      {!eliminated && !finished && (() => {
                        const boxes: ReactNode[] = [];
                        const justCollectedBox = Math.floor(displayWordCount / ITEM_BOX_INTERVAL) * ITEM_BOX_INTERVAL;
                        const nextBox = justCollectedBox + ITEM_BOX_INTERVAL;
                        // Future, un-collected boxes — render them all the way to the finish
                        for (let box = nextBox; box < target; box += ITEM_BOX_INTERVAL) {
                          const boxFraction = Math.min(box / target, 1);
                          boxes.push(
                            <motion.div
                              key={`box-${box}`}
                              className="race-item-box"
                              initial={false}
                              animate={reducedMotion ? { y: 0 } : { y: [0, -1, 0] }}
                              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut", delay: (box / 250) * 0.07 }}
                              style={{
                                position: "absolute",
                                left: `${boxFraction * 100}%`,
                                top: "50%",
                                marginTop: -11,
                                marginLeft: -11,
                                width: 22, height: 22,
                                borderRadius: 5,
                                background:
                                  "linear-gradient(135deg, #fde047 0%, #f6c90e 45%, #b45309 100%)",
                                border: "2px solid rgba(255,255,255,0.7)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.7rem", fontWeight: 900, color: "rgba(255,255,255,0.95)",
                                textShadow: "0 1px 1px rgba(0,0,0,0.45)",
                                boxShadow:
                                  "0 0 8px rgba(253,224,71,0.6), 0 0 18px rgba(246,201,14,0.35), 0 2px 6px rgba(0,0,0,0.35), inset 0 0 6px rgba(255,255,255,0.25)",
                                zIndex: 2,
                                pointerEvents: "none",
                              }}
                            >
                              ?
                            </motion.div>
                          );
                        }
                        // Pop animation on the most-recently-collected box (plays once when justCollectedBox crosses)
                        if (justCollectedBox >= ITEM_BOX_INTERVAL && justCollectedBox < target) {
                          const collectedFraction = Math.min(justCollectedBox / target, 1);
                          boxes.push(
                            <motion.div
                              key={`pop-${p.id}-${justCollectedBox}`}
                              initial={{ opacity: reducedMotion ? 0 : 1, scale: 1, rotate: 0 }}
                              animate={{ opacity: 0, scale: reducedMotion ? 1 : 1.6, rotate: reducedMotion ? 0 : 15 }}
                              transition={{ duration: 0.55, ease: "easeOut" }}
                              style={{
                                position: "absolute",
                                left: `${collectedFraction * 100}%`,
                                top: "50%",
                                marginTop: -13,
                                marginLeft: -13,
                                width: 26, height: 26,
                                borderRadius: 6,
                                background:
                                  "radial-gradient(circle, #fffbeb 0%, #fde047 50%, #f59e0b 100%)",
                                border: "2px solid #fffbeb",
                                boxShadow:
                                  "0 0 20px rgba(253,224,71,0.95), 0 0 40px rgba(245,158,11,0.6)",
                                pointerEvents: "none",
                                zIndex: 4,
                              }}
                            />
                          );
                        }
                        return boxes;
                      })()}

                      {/* Kart with motion — centered horizontally on its fraction so the
                          car's middle aligns with the item-box center (boxes use marginLeft:-11
                          to do the same). */}
                      <RacerPosition fraction={fraction} kart>
                        <div style={{ transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          {/* Crown for 1st place */}
                          {isFirstPlace && !finished && (
                            <div style={{ fontSize: "0.875rem", lineHeight: 1, pointerEvents: "none", textShadow: "0 0 6px #fbbf24" }}>
                              👑
                            </div>
                          )}

                          {/* Name / word count badge */}
                          <div className="race-driver-label" style={{
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

                          {/* Kart SVG — shakes hard when this car is hit by an item */}
                          <motion.div
                            key={isBeingHit ? `hit-${lastHitId}` : "idle"}
                            animate={
                              reducedMotion ? { x: 0, y: 0, rotate: 0 } : isBeingHit
                                ? { x: [0, -3, 2, -1, 0], rotate: [0, -3, 2, 0] }
                                : { x: 0, y: 0, rotate: 0 }
                            }
                            transition={
                              isBeingHit
                                ? { duration: 0.6, ease: "easeOut" }
                                : { duration: .2, ease: "easeOut" }
                            }
                            style={{
                              opacity: eliminated ? 0.4 : 1,
                              filter: hasStarActive
                                ? "drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 10px #fde047)"
                                : isBeingHit
                                  ? "drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 16px rgba(239,68,68,0.55))"
                                  : undefined,
                            }}
                          >
                            {activeCarSkin ? (
                              <SkinnedKart
                                skinKey={activeCarSkin}
                                laneNum={laneIndex + 1}
                                fallbackColor={eliminated ? "#6b7280" : finished ? "#fbbf24" : undefined}
                                fallbackShade={eliminated ? "#4b5563" : finished ? "#d97706" : undefined}
                                fallbackLight={eliminated ? "#9ca3af" : finished ? "#fcd34d" : undefined}
                              />
                            ) : (
                              <RaceKart
                                car={eliminated ? "#6b7280" : finished ? "#fbbf24" : colors.car}
                                shade={eliminated ? "#4b5563" : finished ? "#d97706" : colors.shade}
                                light={eliminated ? "#9ca3af" : finished ? "#fcd34d" : colors.light}
                                laneNum={laneIndex + 1}
                              />
                            )}
                          </motion.div>
                        </div>
                      </RacerPosition>

                      {/* Per-lane item-use animations (shells, lightning bolt, mushroom trail, etc.) */}
                      <KartLaneEffects
                        effects={activeEffects}
                        participantId={p.id}
                        targetFraction={fraction}
                        participantFractions={participantFractions}
                      />
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
                    <AnimatePresence initial={false}>
                      {finished && (
                        <motion.div
                          key="ribbon"
                          initial={{ opacity: 0, x: reducedMotion ? 0 : 8 }}
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
          <div style={{ height: 6, background: roadStyle.bottomKerb, opacity: 0.85 }} />

          {/* Track-wide effect overlays (lightning flash, blue-shell red alert) */}
          <KartEffectsLayer effects={activeEffects} />
        </div>
      </motion.div>
    );
  }

  // ── Regular (non-kart) race track ──────────────────────────────────────
  return (
    <div className="race-track race-track-regular w-full rounded-xl overflow-hidden shadow-sm border" style={{ background: roadStyle.trackBg }}>
      <div className="race-track-heading flex items-center justify-between px-4 py-1 border-b border-white/10">
        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
          Race Track
          {reaperFraction !== null && (
            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">💀 Death</span>
          )}
        </span>
        <span className="text-white/50 text-xs font-mono">
          {hasGoal ? "goal" : "scale"}: {target.toLocaleString()} words &nbsp;·&nbsp; {participants.length} {participants.length === 1 ? "writer" : "writers"}
        </span>
      </div>

      <div className="race-road relative">
        <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: "56px", width: "4px", background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.65) 0px, rgba(255,255,255,0.65) 6px, rgba(0,0,0,0.55) 6px, rgba(0,0,0,0.55) 12px)" }} />
        <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ right: "16px", width: "5px", background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 6px, rgba(0,0,0,0.7) 6px, rgba(0,0,0,0.7) 12px)" }}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-[10px] font-bold whitespace-nowrap" style={{ opacity: 0.8 }}>{hasGoal ? "FINISH" : "SCALE"}</div>
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
              const displayWordCount = isMe && localWordCount !== undefined ? Math.max(0, localWordCount) : p.wordCount;
              const effectiveWordCount = Math.max(0, displayWordCount + (carOffsets?.[p.id] ?? 0));
              const fraction = Math.min(effectiveWordCount / target, 1);
              const finished = hasGoal && displayWordCount >= target;
              const eliminated = reaperWordCount != null && displayWordCount < reaperWordCount && !finished;
              const hasStarActive = starActiveIds?.includes(p.id) ?? false;
              const isFirstPlace = firstPlaceId === p.id;

              return (
                <div key={p.id} className="race-lane relative" style={{ height: "50px", background: eliminated ? "rgba(239,68,68,0.08)" : finished ? "rgba(255,255,255,0.08)" : laneIndex % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.10)", borderBottom: eliminated ? "1px solid rgba(239,68,68,0.18)" : "1px solid rgba(255,255,255,0.06)", opacity: eliminated ? 0.55 : 1, transition: "background 0.4s, opacity 0.4s" }}>
                  <div className="absolute top-1/2 -translate-y-1/2 left-14 right-6 pointer-events-none" style={{ height: "2px", background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 12px, transparent 12px, transparent 24px)" }} />
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold font-mono" style={{ width: "20px", textAlign: "center" }}>{laneIndex + 1}</div>

                  <div className="absolute top-0 bottom-0" style={{ left: "59px", right: `${16 + CAR_W}px` }}>

                    <RacerPosition fraction={fraction}>
                      <div className="race-driver-label flex items-center gap-1 mb-0.5 whitespace-nowrap" style={{ background: eliminated ? "rgba(60,60,60,0.85)" : isMe ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)", borderRadius: "4px", padding: "1px 6px", boxShadow: eliminated ? "0 0 0 2px #ef4444" : finished ? "0 0 0 2px #fbbf24" : isMe ? `0 0 0 2px ${colors.car}` : "none" }}>
                        <span className="text-[10px] font-bold truncate max-w-[60px]" style={{ color: eliminated ? "#fca5a5" : finished ? "#92400e" : colors.shade }}>{eliminated ? "💀" : finished ? "🏁" : ""}{isMe ? "You" : p.name}</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: eliminated ? "#f87171" : "#374151" }}>{displayWordCount}w</span>
                      </div>

                      {isFirstPlace && isKartMode && !finished && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm leading-none pointer-events-none" style={{ textShadow: "0 0 6px #fbbf24" }}>👑</div>
                      )}

                      <motion.div animate={{ scale: 1 }} style={{ opacity: eliminated ? 0.4 : 1, filter: hasStarActive ? "drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 10px #fde047)" : undefined }}>
                        {activeCarSkin ? (
                          <SkinnedCar skinKey={activeCarSkin} color={eliminated ? "#6b7280" : finished ? "#fbbf24" : undefined} />
                        ) : (
                          <RoadCar car={eliminated ? "#6b7280" : finished ? "#fbbf24" : colors.car} shade={eliminated ? "#4b5563" : finished ? "#d97706" : colors.shade} light={eliminated ? "#9ca3af" : finished ? "#fcd34d" : colors.light} />
                        )}
                      </motion.div>
                    </RacerPosition>
                  </div>

                  <AnimatePresence initial={false}>
                    {finished && (
                      <motion.div key="ribbon" initial={{ opacity: 0, x: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, x: 0 }} className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#fbbf24", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
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
