import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";
import type { Participant, EmoteEvent } from "@/hooks/useSprintRoom";

// Curated taunt list — keep these mirrored with the server's EMOTES table in
// artifacts/api-server/src/lib/wsHandler.ts. The server validates by id, so
// adding a new emote requires changes in both places.
export const EMOTES: { id: string; emoji: string; label: string }[] = [
  { id: "too_slow",     emoji: "😏", label: "Too slow!" },
  { id: "haha",         emoji: "😂", label: "Haha!" },
  { id: "eat_dust",     emoji: "🚀", label: "Eat my dust!" },
  { id: "catch_up",     emoji: "🐢", label: "Catch up!" },
  { id: "on_fire",      emoji: "🔥", label: "On fire!" },
  { id: "bow_down",     emoji: "👑", label: "Bow down." },
  { id: "write_faster", emoji: "✍️", label: "Write faster!" },
  { id: "good_luck",    emoji: "🤝", label: "Good luck!" },
  { id: "bring_it",     emoji: "💪", label: "Bring it!" },
  { id: "wake_up",      emoji: "😴", label: "Wake up!" },
  { id: "big_brain",    emoji: "🧠", label: "Big brain." },
  { id: "gg",           emoji: "🏁", label: "GG!" },
];

const COOLDOWN_MS = 1500;

interface EmoteBarProps {
  participants: Participant[];
  currentParticipantId: string | null;
  onSend: (emoteId: string, targetId: string | null) => void;
  disabled?: boolean;
}

/**
 * Small "Emote" trigger button + popover for picking a taunt and (optionally)
 * a single opponent to direct it at. Designed to live inside the writing
 * toolbar row so it doesn't add visual weight to the room. Sends are
 * client-side rate-limited in addition to the server-side cooldown.
 */
export function EmoteBar({
  participants,
  currentParticipantId,
  onSend,
  disabled = false,
}: EmoteBarProps) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef(0);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Tick the cooldown indicator down to 0.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, COOLDOWN_MS - (Date.now() - lastSentRef.current));
      setCooldownLeft(remaining);
      if (remaining <= 0) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  const opponents = participants.filter((p) => p.id !== currentParticipantId);
  // If the previously selected target left the room, reset to "All".
  useEffect(() => {
    if (targetId && !opponents.some((p) => p.id === targetId)) setTargetId(null);
  }, [targetId, opponents]);

  function handlePick(emoteId: string) {
    if (disabled) return;
    const now = Date.now();
    if (now - lastSentRef.current < COOLDOWN_MS) return;
    lastSentRef.current = now;
    setCooldownLeft(COOLDOWN_MS);
    onSend(emoteId, targetId);
    setOpen(false);
  }

  const cooldownPct = cooldownLeft > 0 ? (cooldownLeft / COOLDOWN_MS) * 100 : 0;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Send emote"
        aria-expanded={open}
        title={disabled ? "Connect to a room to send emotes" : "Send an emote"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: "0 10px",
          borderRadius: 8,
          border: "1px solid rgba(107,143,212,0.2)",
          background: open
            ? "linear-gradient(135deg, #eceeff, #e0e4ff)"
            : "rgba(255,255,255,0.7)",
          color: "#1a1a2e",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          position: "relative",
          overflow: "hidden",
          transition: "background .15s, border-color .15s",
        }}
      >
        <Smile size={14} />
        <span>Emote</span>
        {cooldownLeft > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0, bottom: 0,
              height: 2,
              width: `${cooldownPct}%`,
              background: "#6B8FD4",
              transition: "width .1s linear",
            }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="emote-popover"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="dialog"
            aria-label="Choose an emote"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 60,
              width: 260,
              background: "rgba(255,255,255,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(107,143,212,0.18)",
              borderRadius: 14,
              boxShadow: "0 12px 40px rgba(26,26,46,0.18)",
              padding: 10,
            }}
          >
            {/* Target picker */}
            {opponents.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                  Send to
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <TargetChip
                    label="Everyone"
                    selected={targetId === null}
                    onClick={() => setTargetId(null)}
                  />
                  {opponents.map((p) => (
                    <TargetChip
                      key={p.id}
                      label={p.name}
                      selected={targetId === p.id}
                      onClick={() => setTargetId(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Emote grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {EMOTES.map((e) => {
                const onCooldown = cooldownLeft > 0;
                return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => handlePick(e.id)}
                  disabled={onCooldown}
                  title={onCooldown ? `Cooldown ${(cooldownLeft / 1000).toFixed(1)}s` : e.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    padding: "8px 4px",
                    borderRadius: 10,
                    border: "1px solid transparent",
                    background: "rgba(107,143,212,0.06)",
                    cursor: onCooldown ? "not-allowed" : "pointer",
                    opacity: onCooldown ? 0.45 : 1,
                    transition: "background .12s, border-color .12s, transform .08s, opacity .12s",
                  }}
                  onMouseEnter={(ev) => {
                    if (onCooldown) return;
                    ev.currentTarget.style.background = "rgba(107,143,212,0.16)";
                    ev.currentTarget.style.borderColor = "rgba(107,143,212,0.35)";
                  }}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.background = "rgba(107,143,212,0.06)";
                    ev.currentTarget.style.borderColor = "transparent";
                  }}
                  onMouseDown={(ev) => { if (!onCooldown) ev.currentTarget.style.transform = "scale(0.96)"; }}
                  onMouseUp={(ev) => { ev.currentTarget.style.transform = "scale(1)"; }}
                >
                  <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{e.emoji}</span>
                  <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#374151", textAlign: "center", lineHeight: 1.15 }}>
                    {e.label}
                  </span>
                </button>
                );
              })}
            </div>

            <div style={{ marginTop: 8, fontSize: "0.6rem", color: "#9CA3AF", textAlign: "center" }}>
              {cooldownLeft > 0
                ? `Cooldown ${(cooldownLeft / 1000).toFixed(1)}s`
                : `Keep it friendly. ${COOLDOWN_MS / 1000}s cooldown.`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TargetChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${selected ? "#6B8FD4" : "rgba(107,143,212,0.25)"}`,
        background: selected ? "#6B8FD4" : "rgba(255,255,255,0.6)",
        color: selected ? "#fff" : "#1a1a2e",
        fontSize: "0.65rem",
        fontWeight: 600,
        cursor: "pointer",
        maxWidth: 110,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "background .12s, border-color .12s",
      }}
    >
      {label}
    </button>
  );
}

interface EmoteOverlayProps {
  emotes: EmoteEvent[];
  currentParticipantId: string | null;
}

/**
 * Top-right floating stack of recent emote chips. Bubbles directed AT the
 * current player are highlighted in red so taunts stand out without being
 * disruptive. Auto-pruned by the hook after EMOTE_DISPLAY_MS.
 */
export function EmoteOverlay({ emotes, currentParticipantId }: EmoteOverlayProps) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 80,
        right: 16,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
        maxWidth: 280,
      }}
    >
      <AnimatePresence initial={false}>
        {emotes.map((e) => {
          const fromMe = e.sourceId === currentParticipantId;
          const targetedAtMe = e.targetId === currentParticipantId && !fromMe;
          const fromLabel = fromMe ? "You" : e.sourceName;
          let toFragment = "";
          if (e.targetId) {
            if (e.targetId === currentParticipantId) toFragment = " → You";
            else if (e.targetName) toFragment = ` → ${e.targetName}`;
          }
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 24, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: targetedAtMe
                  ? "linear-gradient(135deg, #fef2f2, #fee2e2)"
                  : "rgba(255,255,255,0.96)",
                border: `1px solid ${targetedAtMe ? "rgba(220,38,38,0.45)" : "rgba(107,143,212,0.25)"}`,
                boxShadow: targetedAtMe
                  ? "0 6px 20px rgba(220,38,38,0.18)"
                  : "0 6px 20px rgba(26,26,46,0.10)",
                color: "#1a1a2e",
                fontSize: "0.78rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{e.emoji}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: targetedAtMe ? "#dc2626" : "#6B8FD4", fontWeight: 700 }}>
                  {fromLabel}
                </span>
                <span style={{ color: "#6B7280", fontWeight: 500 }}>{toFragment}: </span>
                <span>{e.label}</span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
