import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { RaceTrack } from "@/components/RaceTrack";
import { Participant, RoomState } from "@/hooks/useSprintRoom";
import { Home, FileText, Eye, EyeOff, Zap } from "lucide-react";

interface GameOverScreenProps {
  wordsWritten: number;
  survivedSeconds: number;
  room: RoomState;
  currentParticipantId: string | null;
  reaperWordCount: number | null;
}

function wpmFromStats(words: number, seconds: number) {
  if (seconds < 5) return 0;
  return Math.round((words / seconds) * 60);
}

const SKULL_SVG = (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Outer glow */}
    <circle cx="60" cy="52" r="38" fill="rgba(239,68,68,0.08)" />
    {/* Skull dome */}
    <path
      d="M60 18C39.5 18 23 33.5 23 52c0 12 6.5 22.5 16.5 28.5V90h41V80.5C90.5 74.5 97 64 97 52 97 33.5 80.5 18 60 18z"
      fill="#1a1a1a" stroke="#ef4444" strokeWidth="2"
    />
    {/* Left eye socket */}
    <ellipse cx="47" cy="54" rx="9" ry="11" fill="#ef4444" opacity="0.85" />
    {/* Right eye socket */}
    <ellipse cx="73" cy="54" rx="9" ry="11" fill="#ef4444" opacity="0.85" />
    {/* Left pupil glow */}
    <ellipse cx="47" cy="54" rx="4" ry="5" fill="#fca5a5" opacity="0.6" />
    {/* Right pupil glow */}
    <ellipse cx="73" cy="54" rx="4" ry="5" fill="#fca5a5" opacity="0.6" />
    {/* Nose */}
    <path d="M57 68l3-7 3 7z" fill="#ef4444" opacity="0.6" />
    {/* Jaw */}
    <rect x="39" y="90" width="42" height="13" rx="3" fill="#1a1a1a" stroke="#ef4444" strokeWidth="1.5" />
    {/* Teeth */}
    {[42, 50, 58, 66, 74].map((x) => (
      <rect key={x} x={x} y="90" width="6" height="10" rx="1" fill="#2a2a2a" stroke="#ef4444" strokeWidth="1" />
    ))}
    {/* Crack lines */}
    <path d="M60 18 L63 35 L58 42 L65 52" stroke="#ef4444" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
    <path d="M75 24 L72 38" stroke="#ef4444" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
  </svg>
);

const PARTICLE_COUNT = 22;

function DeathParticles() {
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 3 + Math.random() * 5,
    size: 2 + Math.random() * 5,
    opacity: 0.1 + Math.random() * 0.3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-red-500"
          style={{ left: `${p.x}%`, bottom: 0, width: p.size, height: p.size, opacity: 0 }}
          animate={{ y: [0, -400 - Math.random() * 300], opacity: [0, p.opacity, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export function GameOverScreen({
  wordsWritten,
  survivedSeconds,
  room,
  currentParticipantId,
  reaperWordCount,
}: GameOverScreenProps) {
  const [, navigate] = useLocation();
  const [spectating, setSpectating] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const wpm = wpmFromStats(wordsWritten, survivedSeconds);
  const minutesSurvived = Math.floor(survivedSeconds / 60);
  const secsSurvived = survivedSeconds % 60;
  const survivedLabel = minutesSurvived > 0
    ? `${minutesSurvived}m ${secsSurvived}s`
    : `${secsSurvived}s`;

  const totalParticipants = room.participants.length;
  const stillAlive = room.participants.filter((p) =>
    reaperWordCount == null || p.wordCount >= reaperWordCount
  ).length;

  useEffect(() => {
    const t = setTimeout(() => setShowStats(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto" style={{ background: "#0a0a0f" }}>
      <DeathParticles />

      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          zIndex: 1,
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-10 gap-8">

        {/* Skull + title */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-28 h-28 relative">
            <motion.div
              animate={{ filter: ["drop-shadow(0 0 8px #ef4444)", "drop-shadow(0 0 20px #ef4444)", "drop-shadow(0 0 8px #ef4444)"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-full"
            >
              {SKULL_SVG}
            </motion.div>
          </div>

          <div className="text-center">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-black tracking-widest uppercase text-5xl"
              style={{ color: "#ef4444", textShadow: "0 0 30px rgba(239,68,68,0.6), 0 0 60px rgba(239,68,68,0.3)" }}
            >
              ELIMINATED
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-red-400/60 text-sm font-mono tracking-[0.3em] uppercase mt-1"
            >
              The reaper claimed you
            </motion.p>
          </div>
        </motion.div>

        {/* Stats cards */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-3 gap-3 w-full max-w-md"
            >
              {[
                { label: "Words Written", value: wordsWritten.toLocaleString(), icon: "📝" },
                { label: "WPM", value: wpm === 0 ? "—" : wpm, icon: <Zap className="w-4 h-4" /> },
                { label: "Survived", value: survivedLabel, icon: "⏱" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-red-900/40 py-4 px-3"
                  style={{ background: "rgba(239,68,68,0.06)" }}
                >
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-2xl font-black text-red-300 tabular-nums">{stat.value}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-red-900/80 dark:text-red-400/50">{stat.label}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Survivor count */}
        {showStats && totalParticipants > 1 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-red-400/50 text-xs font-mono tracking-widest uppercase"
          >
            {stillAlive} of {totalParticipants} still surviving
          </motion.p>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          <button
            onClick={() => navigate("/portal?tab=past")}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60 hover:text-red-200"
            style={{ background: "rgba(239,68,68,0.07)" }}
          >
            <FileText className="w-4 h-4" />
            My Writing
          </button>

          <button
            onClick={() => navigate("/portal")}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border border-white/10 text-white/50 hover:bg-white/5 hover:border-white/20 hover:text-white/70"
          >
            <Home className="w-4 h-4" />
            Home
          </button>

          {room.status === "running" && (
            <button
              onClick={() => setSpectating((s) => !s)}
              className={`flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                spectating
                  ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                  : "border-white/10 text-white/40 hover:bg-white/5 hover:border-white/20 hover:text-white/60"
              }`}
            >
              {spectating ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {spectating ? "Hide Race" : "Spectate Race"}
            </button>
          )}
        </motion.div>

        {/* Spectate panel */}
        <AnimatePresence>
          {spectating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl overflow-hidden"
            >
              <div className="rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10" style={{ background: "#111118" }}>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Spectating — Read Only</span>
                  <span className="ml-auto text-[10px] text-white/30 font-mono">live</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <RaceTrack
                  participants={room.participants}
                  currentParticipantId={null}
                  durationMinutes={room.durationMinutes}
                  wordGoal={room.wordGoal}
                  reaperWordCount={reaperWordCount}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flavour line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-[11px] text-white/15 font-mono mt-auto pt-4 text-center italic"
        >
          "The blank page is patient. Come back when you're ready."
        </motion.p>
      </div>
    </div>
  );
}
