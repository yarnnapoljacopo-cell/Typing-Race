import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { RaceTrack } from "@/components/RaceTrack";
import { RoomState } from "@/hooks/useSprintRoom";
import { Capsule } from "@/components/WritingArchive";
import { Home, Eye, EyeOff, Zap, Copy, Check, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface GameOverScreenProps {
  wordsWritten: number;
  survivedSeconds: number;
  room: RoomState;
  currentParticipantId: string | null;
  reaperWordCount: number | null;
  text: string;
  capsules: Capsule[];
}

function wpmFromStats(words: number, seconds: number) {
  if (seconds < 5) return 0;
  return Math.round((words / seconds) * 60);
}

function formatTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function htmlToPlain(html: string) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  // innerText returns "" on detached elements in many browsers; fall back to
  // textContent, then to a manual regex strip so we never lose the user's text.
  const inner = div.innerText || div.textContent || "";
  if (inner.trim()) return inner;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
        copied
          ? "bg-green-900/40 text-green-400 border border-green-700/40"
          : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

const SKULL_SVG = (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <circle cx="60" cy="52" r="38" fill="rgba(239,68,68,0.08)" />
    <path
      d="M60 18C39.5 18 23 33.5 23 52c0 12 6.5 22.5 16.5 28.5V90h41V80.5C90.5 74.5 97 64 97 52 97 33.5 80.5 18 60 18z"
      fill="#1a1a1a" stroke="#ef4444" strokeWidth="2"
    />
    <ellipse cx="47" cy="54" rx="9" ry="11" fill="#ef4444" opacity="0.85" />
    <ellipse cx="73" cy="54" rx="9" ry="11" fill="#ef4444" opacity="0.85" />
    <ellipse cx="47" cy="54" rx="4" ry="5" fill="#fca5a5" opacity="0.6" />
    <ellipse cx="73" cy="54" rx="4" ry="5" fill="#fca5a5" opacity="0.6" />
    <path d="M57 68l3-7 3 7z" fill="#ef4444" opacity="0.6" />
    <rect x="39" y="90" width="42" height="13" rx="3" fill="#1a1a1a" stroke="#ef4444" strokeWidth="1.5" />
    {[42, 50, 58, 66, 74].map((x) => (
      <rect key={x} x={x} y="90" width="6" height="10" rx="1" fill="#2a2a2a" stroke="#ef4444" strokeWidth="1" />
    ))}
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
  text,
  capsules,
}: GameOverScreenProps) {
  const [, navigate] = useLocation();
  const [spectating, setSpectating] = useState(false);
  const [writingOpen, setWritingOpen] = useState(false);
  const [writingTab, setWritingTab] = useState<"text" | "capsules">("text");
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

  const plainText = htmlToPlain(text);
  const hasCapsules = capsules.length > 0;
  const hasWriting = plainText.trim().length > 0 || hasCapsules;

  useEffect(() => {
    const t = setTimeout(() => setShowStats(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto" style={{ background: "#0a0a0f" }}>
      <DeathParticles />

      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          zIndex: 1,
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 py-10 gap-7">

        {/* Skull + ELIMINATED */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-28 h-28">
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

        {/* Stats */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
          {/* My Writing — inline toggle (always shown) */}
          <button
            onClick={() => setWritingOpen((o) => !o)}
            className={`flex items-center justify-between w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 border ${
              writingOpen
                ? "border-red-500/50 text-red-300 bg-red-500/10"
                : "border-red-500/30 text-red-300 hover:bg-red-500/10 hover:border-red-500/60"
            }`}
            style={{ background: writingOpen ? undefined : "rgba(239,68,68,0.07)" }}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4" />
              My Writing
            </div>
            {writingOpen ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />}
          </button>

          <button
            onClick={() => navigate("/portal")}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 border border-white/10 text-white/50 hover:bg-white/5 hover:border-white/20 hover:text-white/70"
          >
            <Home className="w-4 h-4" />
            Home
          </button>

          {room.participants.length > 0 && (
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

        {/* My Writing panel */}
        <AnimatePresence>
          {writingOpen && hasWriting && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl overflow-hidden"
            >
              <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "#111118" }}>
                {/* Tab bar */}
                <div className="flex items-center gap-0 border-b border-white/10">
                  {(["text", "capsules"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setWritingTab(tab)}
                      className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                        writingTab === tab
                          ? "text-red-300 border-b-2 border-red-500 bg-red-500/5"
                          : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      {tab === "text" ? "Your Text" : `Capsules (${capsules.length})`}
                    </button>
                  ))}
                  <div className="ml-auto px-3">
                    {writingTab === "text" && plainText.trim() && (
                      <CopyButton getText={() => plainText} label="Copy all" />
                    )}
                  </div>
                </div>

                {/* Text tab */}
                {writingTab === "text" && (
                  <div className="p-4 max-h-80 overflow-y-auto">
                    {plainText.trim() ? (
                      <p
                        className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap font-serif"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {plainText}
                      </p>
                    ) : (
                      <p className="text-white/25 text-sm italic text-center py-6">Nothing written yet</p>
                    )}
                  </div>
                )}

                {/* Capsules tab */}
                {writingTab === "capsules" && (
                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                    {capsules.length === 0 ? (
                      <p className="text-white/25 text-sm italic text-center py-6">No capsules yet — they save every 200 words</p>
                    ) : (
                      [...capsules].reverse().map((c, i) => {
                        const plain = htmlToPlain(c.text);
                        const preview = plain.slice(0, 120).trim();
                        return (
                          <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                  {c.isFinal ? "Final snapshot" : `${c.wordCount} words`}
                                </span>
                                <span className="text-[10px] text-white/25 font-mono">{formatTime(c.savedAt)}</span>
                              </div>
                              <p className="text-white/45 text-xs leading-relaxed line-clamp-2 font-serif" style={{ fontFamily: "Georgia, serif" }}>
                                {preview}{plain.length > 120 ? "…" : ""}
                              </p>
                            </div>
                            <CopyButton getText={() => plain} label="Copy" />
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* Flavour */}
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
