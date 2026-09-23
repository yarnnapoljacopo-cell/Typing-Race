import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Smile } from "lucide-react";
import type { Participant, EmoteEvent } from "@/hooks/useSprintRoom";
import { EmoteIcon, hasEmoteIcon } from "./EmoteIcons";

// Curated taunt list — keep these mirrored with the server's EMOTES table in
// artifacts/api-server/src/lib/wsHandler.ts. The server validates by id, so
// adding a new emote requires changes in both places. The `emoji` field is a
// text fallback used only when EmoteIcon doesn't have a matching id.
export const EMOTES: { id: string; emoji: string; label: string }[] = [
  { id: "too_slow",     emoji: "🐌", label: "Too slow!" },
  { id: "haha",         emoji: "😂", label: "Haha!" },
  { id: "eat_dust",     emoji: "🏁", label: "Eat my dust!" },
  { id: "catch_up",     emoji: "➡", label: "Catch up!" },
  { id: "on_fire",      emoji: "🔥", label: "On fire!" },
  { id: "bow_down",     emoji: "👑", label: "Bow down." },
  { id: "write_faster", emoji: "✍", label: "Write faster!" },
  { id: "good_luck",    emoji: "🍀", label: "Good luck!" },
  { id: "bring_it",     emoji: "⚔", label: "Bring it!" },
  { id: "wake_up",      emoji: "⏰", label: "Wake up!" },
  { id: "big_brain",    emoji: "🧠", label: "Big brain." },
  { id: "gg",           emoji: "🏆", label: "GG!" },
];

const COOLDOWN_MS = 1500;
const POPOVER_WIDTH = 280;

interface EmoteBarProps {
  participants: Participant[];
  currentParticipantId: string | null;
  onSend: (emoteId: string, targetId: string | null) => void;
  disabled?: boolean;
}

/**
 * Small "Emote" trigger button + popover for picking a taunt and (optionally)
 * a single opponent to direct it at. The popover is portaled to document.body
 * with fixed positioning so it can't be clipped or covered by the editor's
 * stacking context.
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
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef(0);

  // Recompute fixed-position coords for the popover when opened, on resize and
  // on scroll. We anchor to the button's bottom-right and clamp to viewport so
  // it never spills off-screen on mobile.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const margin = 8;
      const estimatedHeight = 354;
      const showAbove = window.innerHeight - r.bottom < estimatedHeight && r.top > estimatedHeight;
      const top = showAbove ? Math.max(margin, r.top - estimatedHeight - 6) : r.bottom + 6;
      const desiredLeft = r.right - POPOVER_WIDTH;
      const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - POPOVER_WIDTH - margin));
      setPopoverPos({ top, left, maxHeight: Math.max(170, window.innerHeight - top - margin) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Close on outside click + Escape. Outside = neither the trigger button nor
  // the portaled popover.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
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
    <>
      <button
        ref={buttonRef}
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
          border: open ? "1px solid #9dbad1" : "1px solid rgba(69,91,114,0.35)",
          background: open ? "linear-gradient(135deg, #263b51, #142439)" : "linear-gradient(135deg, #f7fafb, #e7edf0)",
          boxShadow: open ? "0 0 0 2px #80b8d333, inset 0 1px #ffffff25" : "inset 0 1px #fff, 0 1px 3px #18283a1f",
          color: open ? "#edf8ff" : "#26394e",
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
              background: "#69a9c8",
              transition: "width .1s linear",
            }}
          />
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && popoverPos && (
            <motion.div
              ref={popoverRef}
              key="emote-popover"
              initial={{ opacity: 0, y: reducedMotion ? 0 : -7, scale: reducedMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -5, scale: reducedMotion ? 1 : 0.97 }}
              transition={{ type: "spring", duration: reducedMotion ? 0.01 : 0.22, bounce: 0.12 }}
              role="dialog"
              aria-label="Choose an emote"
              style={{
                position: "fixed",
                top: popoverPos.top,
                left: popoverPos.left,
                zIndex: 9999,
                width: POPOVER_WIDTH,
                maxHeight: popoverPos.maxHeight,
                overflowY: "auto",
                background: "linear-gradient(155deg, rgba(34,52,70,0.98), rgba(17,29,43,0.99))",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(183,213,231,0.4)",
                borderRadius: 12,
                boxShadow: "0 14px 42px rgba(9,20,32,0.4), inset 0 1px rgba(255,255,255,0.14)",
                padding: 10,
              }}
            >
              {/* Target picker */}
              {opponents.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#b9d0df", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
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
                        gap: 4,
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: "1px solid rgba(155,187,207,0.32)",
                        background: "linear-gradient(155deg, #ecf2f3, #d3dee4)",
                        cursor: onCooldown ? "not-allowed" : "pointer",
                        opacity: onCooldown ? 0.45 : 1,
                        boxShadow: "inset 0 1px #fff, 0 2px 4px #0715213b",
                        transition: "background .16s, border-color .16s, transform .16s, opacity .16s, box-shadow .16s",
                      }}
                      onMouseEnter={(ev) => {
                        if (onCooldown) return;
                        ev.currentTarget.style.background = "linear-gradient(155deg, #ffffff, #dfedf4)";
                        ev.currentTarget.style.borderColor = "rgba(112,181,214,0.85)";
                        ev.currentTarget.style.boxShadow = "inset 0 1px #fff, 0 5px 14px #05162470";
                        ev.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(ev) => {
                        ev.currentTarget.style.background = "linear-gradient(155deg, #ecf2f3, #d3dee4)";
                        ev.currentTarget.style.borderColor = "rgba(155,187,207,0.32)";
                        ev.currentTarget.style.boxShadow = "inset 0 1px #fff, 0 2px 4px #0715213b";
                        ev.currentTarget.style.transform = "translateY(0)";
                      }}
                      onMouseDown={(ev) => { if (!onCooldown) ev.currentTarget.style.transform = "scale(0.96)"; }}
                      onMouseUp={(ev) => { ev.currentTarget.style.transform = "scale(1)"; }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 30 }}>
                        <EmoteIcon id={e.id} size={28} />
                      </span>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#2c3b49", textAlign: "center", lineHeight: 1.15, fontFamily: "system-ui, sans-serif" }}>
                        {e.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 8, fontSize: "0.6rem", color: "#a9c2d0", textAlign: "center" }}>
                {cooldownLeft > 0
                  ? `Cooldown ${(cooldownLeft / 1000).toFixed(1)}s`
                  : `Keep it friendly. ${COOLDOWN_MS / 1000}s cooldown.`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
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
        border: `1px solid ${selected ? "#9bd1e7" : "rgba(178,208,224,0.36)"}`,
        background: selected ? "linear-gradient(135deg,#82b9d2,#44728e)" : "rgba(228,242,248,0.09)",
        color: selected ? "#fff" : "#d8e7ef",
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
 * disruptive. Auto-pruned by the hook after EMOTE_DISPLAY_MS. Renders the
 * branded EmoteIcon when the id is known, falling back to the server-provided
 * emoji glyph for forwards-compatibility with new emotes the client doesn't
 * recognize yet.
 */
export function EmoteOverlay({ emotes, currentParticipantId }: EmoteOverlayProps) {
  const reducedMotion = useReducedMotion();
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
          const known = hasEmoteIcon(e.emoteId);
          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 34, scale: reducedMotion ? 1 : 0.86, rotate: targetedAtMe && !reducedMotion ? 3 : 0 }}
              animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : 22, scale: reducedMotion ? 1 : 0.95 }}
              transition={{ type: "spring", duration: reducedMotion ? 0.01 : 0.35, bounce: 0.18 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 10,
                background: targetedAtMe
                  ? "linear-gradient(130deg, #fff2ed, #efd7d0)"
                  : "linear-gradient(130deg, #f4fafb, #dce7ed)",
                border: `1px solid ${targetedAtMe ? "rgba(169,89,74,0.6)" : "rgba(103,143,164,0.5)"}`,
                boxShadow: targetedAtMe
                  ? "0 7px 22px rgba(105,39,27,0.25), inset 0 1px #fff"
                  : "0 7px 22px rgba(20,45,63,0.19), inset 0 1px #fff",
                color: "#203448",
                fontSize: "0.78rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0 }}>
                {known ? (
                  <EmoteIcon id={e.emoteId} size={22} />
                ) : (
                  <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{e.emoji}</span>
                )}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: targetedAtMe ? "#ae5140" : "#416c88", fontWeight: 800 }}>
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
