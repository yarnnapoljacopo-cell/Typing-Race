import { demoStorageKey, isDemoSession } from "@/lib/demoSession";
import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from "react";
import { recoverWritingBaseline, sprintWords } from "@/lib/writingProgress";
import { countWritingWords as countWords, editorPlainText } from "@/lib/writingText";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useSprintRoom, type RoomState, type Participant } from "@/hooks/useSprintRoom";
import { getNameplateStyle } from "@/lib/nameplates";
import { SkinOverlay } from "@/components/SkinOverlay";
import { RaceTrack } from "@/components/RaceTrack";
import { KartHUD } from "@/components/KartHUD";
import { GladiatorHUD } from "@/components/GladiatorHUD";
import { GladiatorResults } from "@/components/GladiatorResults";
import { BossTrack } from "@/components/BossTrack";
import { Timer } from "@/components/Timer";
import { ResultsScreen } from "@/components/ResultsScreen";
import { GameOverScreen } from "@/components/GameOverScreen";
import { WritingToolbar, type WritingStyle, type FormatType } from "@/components/WritingToolbar";
import { EmoteBar, EmoteOverlay } from "@/components/EmoteBar";
import { WritingArchive, type Capsule } from "@/components/WritingArchive";
import { SpectatorView } from "@/components/SpectatorView";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle, Loader2, Play, WifiOff, Eye, Download, BookCheck, BookOpen, PenLine, Maximize2, Minimize2, LogOut, NotebookPen, Clock } from "lucide-react";
import StickyNote from "./StickyNote";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ChestAwardModal } from "@/components/ChestAwardModal";
import { BetModal } from "@/components/BetModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import FolioSaveDialog, { type FolioTarget } from "./FolioSaveDialog";
import { folioStore } from "@/lib/folioStore";

const CAPSULE_INTERVAL = 200;

// ── Helpers ────────────────────────────────────────────────────────────────

function useSearchParams() {
  return useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
}

// Apply per-paragraph inline styles for a given spacing mode.
// Inline styles win over the CSS default so each <p> carries its own mode.
function applyModeToP(p: HTMLElement, mode: string): void {
  p.style.textIndent = mode === "indent" ? "1.5em" : "";
  if (mode === "double") {
    p.style.lineHeight = "inherit";
    p.style.marginBottom = "28px";
    p.style.marginTop = "0";
  } else {
    p.style.lineHeight = "inherit";
    p.style.marginBottom = "0";
    p.style.marginTop = "0";
  }
}

function plainTextFromHtml(html: string): string {
  const element = document.createElement("div");
  element.innerHTML = html;
  return editorPlainText(element);
}

// Play a short ascending chime when the sprint starts (Web Audio API, no file needed)
function playStartSound() {
  try {
    const ctx = new AudioContext();
    // Three-note ascending arpeggio: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t);
      osc.stop(t + 0.6);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch { /* audio unavailable — silent fallback */ }
}

// Schedule a function during browser idle time so it never blocks typing
function scheduleIdle(fn: () => void) {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 0);
  }
}

function autoSaveKey(code: string) {
  return demoStorageKey(`sprint-autosave-${code}`);
}

const SETTINGS_KEY = "sprint-writing-style";

function loadWritingStyle(): WritingStyle {
  const defaults: WritingStyle = {
    fontFamily: "Georgia, serif",
    fontSize: 18,
    lineHeight: 1.75,
    paragraphMode: "none",
    typewriterMode: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function capsulesKey(code: string) {
  return demoStorageKey(`sprint-capsules-${code}`);
}

function loadCapsules(code: string): Capsule[] {
  if (!code) return [];
  try {
    const raw = localStorage.getItem(capsulesKey(code));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCapsules(code: string, capsules: Capsule[]) {
  if (!code) return;
  try {
    localStorage.setItem(capsulesKey(code), JSON.stringify(capsules));
  } catch { /* ignore */ }
}

// ── Writers cluster + hover dropdown ──────────────────────────────────────

function RoomWritersDropdown({
  participants,
  onOpenProfile,
}: {
  participants: Participant[];
  onOpenProfile: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const openTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = "room-writers-panel";

  const cancel = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) { clearTimeout(ref.current); ref.current = null; }
  };
  const openNow = () => { cancel(closeTimer); cancel(openTimer); setOpen(true); };
  const handleEnter = () => {
    cancel(closeTimer);
    if (open) return;
    openTimer.current = setTimeout(() => setOpen(true), 100);
  };
  const handleLeave = () => {
    cancel(openTimer);
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => () => { cancel(openTimer); cancel(closeTimer); }, []);

  // Close on Escape; close on outside click / focus moving outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={openNow}
      onBlur={(e) => {
        // Close when focus leaves the entire group.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          handleLeave();
        }
      }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, fontSize: "0.83rem", fontWeight: 500, color: "#7a7a92", cursor: "default" }}
    >
      {/* Single keyboard/touch toggle wrapping the avatar stack + count */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${participants.length} ${participants.length === 1 ? "writer" : "writers"} in this room — view list`}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "none", border: "none", padding: 0, cursor: "pointer",
          color: "inherit", font: "inherit",
        }}
      >
        <span style={{ display: "flex" }}>
          {participants.slice(0, 4).map((p) => (
            <span
              key={p.id}
              title={p.name}
              style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #6B8FD4, #5a82d0)", color: "white", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -6, border: "2px solid rgba(245,242,236,0.9)" }}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
          ))}
          {participants.length > 4 && (
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(107,143,212,0.15)", fontSize: "0.65rem", fontWeight: 600, color: "#6B8FD4", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -6, border: "2px solid rgba(245,242,236,0.9)" }}>
              +{participants.length - 4}
            </span>
          )}
        </span>
        <span>{participants.length} {participants.length === 1 ? "writer" : "writers"}</span>
      </button>

      {open && participants.length > 0 && (
        <div
          id={panelId}
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            minWidth: 200,
            maxWidth: 260,
            maxHeight: 320,
            overflowY: "auto",
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(107,143,212,0.2)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(26,26,46,0.18)",
            padding: 6,
            animation: "fadeIn 0.12s ease-out",
          }}
        >
          <div style={{ padding: "6px 10px 4px", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase" }}>
            In this room
          </div>
          {participants.map((p) => (
            <button
              key={p.id}
              role="menuitem"
              type="button"
              aria-label={`Open ${p.name}'s profile`}
              onClick={() => { onOpenProfile(p.name); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "7px 10px",
                background: "none", border: "none", cursor: "pointer",
                borderRadius: 9, textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(107,143,212,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
              onFocus={e => (e.currentTarget.style.background = "rgba(107,143,212,0.1)")}
              onBlur={e => (e.currentTarget.style.background = "none")}
            >
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6B8FD4, #5a82d0)", color: "white", fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
              {p.role === "editor" && (
                <span
                  title="Editor — spectating, not racing"
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#6B8FD4",
                    background: "rgba(107,143,212,0.14)",
                    padding: "2px 6px",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                >
                  Editor
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Room() {
  const [, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isSignedIn, userId, getToken } = useAuth();
  const authedFetch = useAuthedFetch();

  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";
  // "writer" (default) gets a car & races. "editor" joins as a visible
  // non-racer — others can see what they're editing/noting.
  const sprintRole: "writer" | "editor" =
    searchParams.get("role") === "editor" ? "editor" : "writer";

  // When the Folio sprint modal embeds /portal in an iframe, this flag is set
  // by Folio in sessionStorage so the Room can post the final text back.
  const isFolioEmbed = (typeof window !== "undefined") && sessionStorage.getItem("folio_sprint_embed") === "1";

  // Read room password from sessionStorage (set by Portal before navigating here)
  const [roomPassword] = useState<string | null>(() => {
    if (!code) return null;
    const key = `room_password_${code}`;
    const pw = sessionStorage.getItem(key);
    if (pw) sessionStorage.removeItem(key); // consume immediately
    return pw;
  });

  const [text, setText] = useState(() => {
    if (code) {
      try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; }
    }
    return "";
  });
  const [wordCount, setWordCount] = useState(() =>
    countWords(plainTextFromHtml((() => { try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; } })()))
  );
  // Persistent save-status pill: never disappears, only upgrades.
  // "unsaved" → "local" (400 ms debounce) → "cloud" (5 s debounce).
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "local" | "cloud">(() =>
    // If we loaded text from localStorage, start in "local" state
    (() => { try { return code && localStorage.getItem(autoSaveKey(code)) ? "local" : "unsaved"; } catch { return "unsaved"; } })()
  );
  const [capsuleFlash, setCapsuleFlash] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [capsules, setCapsules] = useState<Capsule[]>(() => loadCapsules(code));
  const [writingStyle, setWritingStyle] = useState<WritingStyle>(loadWritingStyle);
  const [savedToMyFiles, setSavedToMyFiles] = useState(false);
  const [folioSaveOpen, setFolioSaveOpen] = useState(false);
  const [folioTarget, setFolioTarget] = useState<FolioTarget | null>(() => {
    if (!code) return null;
    try {
      const raw = sessionStorage.getItem(`folio_save_target_${code}`);
      return raw ? (JSON.parse(raw) as FolioTarget) : null;
    } catch { return null; }
  });
  const [folioTargetLabel, setFolioTargetLabel] = useState<string>("");
  const [distractionFree, setDistractionFree] = useState(false);
  const [gladiatorResultDismissed, setGladiatorResultDismissed] = useState(false);
  const isComposingRef = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const [stickyOpen, setStickyOpen] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [survivedSeconds, setSurvivedSeconds] = useState(0);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // ── HUD fade while actively typing ──────────────────────────────────────
  const [isTyping, setIsTyping] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const xpAwardedRef = useRef(false);
  const eliminationStartedRef = useRef(false);
  const sprintStartedAtRef = useRef<number | null>(null);
  const [clientElapsedMs, setClientElapsedMs] = useState(0);

  const textareaRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  // Throttle race-track state updates so mobile doesn't re-render Framer Motion
  // on every keystroke.  The car's 0.6 s easeOut transition hides the 200 ms gap.
  const raceThrottleRef = useRef<number | null>(null);
  const pendingNetWcRef = useRef<number>(0);
  const serverSaveTimeoutRef = useRef<number | null>(null);
  const capsuleFlashTimeoutRef = useRef<number | null>(null);
  const textareaInitDoneRef = useRef(false);
  const pendingCursorRef = useRef<number | null>(null);
  const lastCapsuleThresholdRef = useRef<number>(
    capsules.filter((c) => !c.isFinal).reduce((max, c) => Math.max(max, c.wordCount), 0)
  );
  const currentTextRef = useRef<string>(text);
  const currentCapsulesRef = useRef<Capsule[]>(capsules);
  const finalSnapshotTakenRef = useRef<boolean>(false);
  const serverRestoreDoneRef = useRef<boolean>(false);
  const hasEditedRef = useRef(false);
  const closedRef = useRef(false);
  const serverSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const sprintWasRunningRef = useRef(false);
  const hasAutoDownloadedRef = useRef<boolean>(false);
  // Stores the net word count restored by the server on reconnect so the
  // baseline effect can set the correct offset instead of resetting to 0.
  const restoredNetWordsRef = useRef(0);

  // ── Baseline: words written BEFORE sprint started don't count ──────────
  // Set to the wordCount at the moment the sprint transitions to "running".
  const baselineWordCountRef = useRef<number>(0);
  const [, refreshBaseline] = useState(0);
  const prevStatusRef = useRef<string | null>(null);

  // Current sprint count shared with timers and live UI.
  const netWordCountRef = useRef<number>(0);
  // Sync ref so applyText can read the current paragraph mode without adding
  // writingStyle.paragraphMode to its dep array (which would cascade rebuilds).
  const paragraphModeRef = useRef(writingStyle.paragraphMode);
  paragraphModeRef.current = writingStyle.paragraphMode;
  // Always-current snapshot of room so the interval doesn't read stale state
  const roomRef = useRef<RoomState | null>(null);

  // ── Goal mode tracking ───────────────────────────────────────────────────
  const wordGoalRef = useRef<number | null>(null);
  const goalHitShownRef = useRef<boolean>(false);

  const flushAutoSave = useCallback((immediate = false) => {
    if (!code) return;
    const t = currentTextRef.current;
    const write = () => {
      if (currentTextRef.current !== t || (closedRef.current && !immediate)) return;
      try {
        if (t) localStorage.setItem(autoSaveKey(code), t);
        else localStorage.removeItem(autoSaveKey(code));
        // Upgrade status to at least "local" — never downgrade from "cloud"
        if (currentTextRef.current === t) setSaveStatus((prev) => prev === "cloud" ? "cloud" : "local");
      } catch { /* storage unavailable */ }
    };
    // During normal typing pauses: defer so it never blocks the main thread.
    // During page unload: write immediately (idle callback may never fire).
    if (immediate) write();
    else scheduleIdle(write);
  }, [code]);

  // ── Server backup helpers ───────────────────────────────────────────────
  const serverSaveNow = useCallback((textToSave: string, wc: number, keepalive = false) => {
    if (!code || !name) return;
    // Serialize backups: a slow older response must not overwrite the newest
    // chapter or resurrect text that the writer has deliberately cleared.
    serverSaveQueueRef.current = serverSaveQueueRef.current.catch(() => {}).then(async () => {
      const response = await authedFetch(`/api/rooms/${encodeURIComponent(code)}/writing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: name, text: textToSave, wordCount: wc }),
        keepalive,
      });
      if (response.ok && !closedRef.current && currentTextRef.current === textToSave) setSaveStatus("cloud");
    }).catch(() => { /* localStorage remains the local fallback */ });
  }, [code, name, authedFetch]);

  const scheduleServerSave = useCallback((textToSave: string, wc: number) => {
    if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
    // Reduced from 10 s to 5 s so the cloud copy is always close behind typing
    serverSaveTimeoutRef.current = window.setTimeout(() => serverSaveNow(textToSave, wc), 5_000);
  }, [serverSaveNow]);

  const chapterCountRef = useRef<number>(1);

  const getCurrentPlainText = useCallback(() => {
    return textareaRef.current ? editorPlainText(textareaRef.current) : plainTextFromHtml(currentTextRef.current);
  }, []);

  const saveSilentlyToFolio = useCallback((target: FolioTarget): { ok: boolean; label: string } => {
    try {
      const current = folioStore.getState();
      if (!current.projects.length) return { ok: false, label: "" };
      const proj = current.projects.find((p) => p.id === target.projectId);
      const doc = proj?.docs.find((d) => d.id === target.docId);
      if (!proj || !doc) return { ok: false, label: "" };
      folioStore.setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id !== target.projectId ? p : {
            ...p,
            docs: p.docs.map((d) =>
              d.id !== target.docId ? d : {
                ...d,
                content: getCurrentPlainText(),
                updatedAt: Date.now(),
                status: d.status === "draft" ? "progress" as const : d.status,
              }
            ),
          }
        ),
      }));
      return { ok: true, label: `${proj.name} · ${doc.name}` };
    } catch {
      return { ok: false, label: "" };
    }
  }, [getCurrentPlainText]);

  const saveToMyFiles = useCallback(() => {
    if (folioTarget) {
      const { ok, label } = saveSilentlyToFolio(folioTarget);
      if (ok) {
        setSavedToMyFiles(true);
        toast({ title: `Updated · ${label || "Folio chapter"}` });
        return;
      }
      // Target was deleted from Folio — clear it and reopen the picker.
      try { sessionStorage.removeItem(`folio_save_target_${code}`); } catch { /* ignore */ }
      setFolioTarget(null);
    }
    setFolioSaveOpen(true);
  }, [folioTarget, saveSilentlyToFolio, toast, code]);

  const handleFolioSaved = useCallback((target: FolioTarget, label: string) => {
    setFolioTarget(target);
    setFolioTargetLabel(label);
    setSavedToMyFiles(true);
    try { sessionStorage.setItem(`folio_save_target_${code}`, JSON.stringify(target)); } catch { /* ignore */ }
    toast({ title: `Saved to ${label}` });
  }, [code, toast]);

  const changeFolioTarget = useCallback(() => {
    setFolioSaveOpen(true);
  }, []);

  // Keep authedFetch reachable so the import doesn't go unused (used by other features).
  void authedFetch;

  const downloadWriting = useCallback(() => {
    const plainText = textareaRef.current ? editorPlainText(textareaRef.current) : plainTextFromHtml(currentTextRef.current);
    const blob = new Blob([plainText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `writing-sprint-${code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  // ── Typewriter mode: scroll the editor so the cursor stays centred ───────
  const scrollToCursor = useCallback(() => {
    const div = textareaRef.current;
    if (!div) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !div.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const caret = range.getBoundingClientRect();

    // Degenerate rect: height===0 means the browser hasn't laid out the cursor
    // yet (e.g. fresh empty line after Enter, or cursor off-screen top).
    // Also skip when caret is above the viewport (top <= 0 with bottom <= 0).
    if (caret.height === 0) return;
    if (caret.bottom <= 0) return; // caret scrolled above visible area

    const divRect = div.getBoundingClientRect();
    const lineH = writingStyle.fontSize * writingStyle.lineHeight;
    const caretOffsetTop = caret.top - divRect.top + div.scrollTop;
    // Sanity: offset must be inside the scrollable content
    if (caretOffsetTop < 0 || caretOffsetTop > div.scrollHeight) return;
    div.scrollTop = Math.max(0, caretOffsetTop - div.clientHeight / 2 + lineH / 2);
  }, [writingStyle.fontSize, writingStyle.lineHeight]);

  const {
    room,
    participantId,
    isConnected,
    isReconnecting,
    disconnectReason,
    error,
    actionError,
    clearActionError,
    participantTexts,
    restoredWordCount,
    chestAwarded,
    setChestAwarded,
    setLatestText,
    sendTextUpdate,
    updateLocalWordCount,
    startSprint,
    restartSprint,
    endSprint,
    kartState,
    sendUseItem,
    sendEmote,
    activeEmotes,
    gladiatorState,
    betOutcome,
    setBetOutcome,
    betsSettledTick,
  } = useSprintRoom({ code, name, isCreator: isCreatorParams, password: roomPassword, clerkUserId: userId ?? null, getToken, role: sprintRole });

  // ── Reconnect banner — debounced so sub-2-second blips are invisible ──────
  // Brief network hiccups (Railway proxy resets, mobile handoffs, etc.) resolve
  // faster than 2 s; showing the banner for those would startle writers for no
  // reason. The banner only appears if disconnected for more than 2 seconds.
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  useEffect(() => {
    const disconnected = !isConnected || isReconnecting;
    if (!disconnected) { setShowReconnectBanner(false); return; }
    const t = setTimeout(() => setShowReconnectBanner(true), 2000);
    return () => clearTimeout(t);
  }, [isConnected, isReconnecting]);

  // Find self in the participants list to know what role the server assigned
  // (server may downgrade editor → writer in gladiator mode, etc.).
  const myRole: "writer" | "editor" =
    (room?.participants.find((p) => p.id === participantId)?.role ?? sprintRole);
  const isEditor = myRole === "editor";

  // ── Reaper headstart ────────────────────────────────────────────────────
  // Seconds of headstart the reaper gives the user before it starts moving.
  // Persisted in sessionStorage so a page-refresh keeps the chosen value.
  const [reaperHeadstart, setReaperHeadstart] = useState<number>(() => {
    const stored = sessionStorage.getItem(`reaper-headstart-${code}`);
    return stored ? parseInt(stored, 10) : 3;
  });
  const [showReaperModal, setShowReaperModal] = useState(false);

  // Show the headstart picker once per sprint entry (reset on "finished").
  const reaperModalShownRef = useRef(false);
  useEffect(() => {
    if (!room) return;
    if (room.deathModeWpm == null) return; // not a reaper room
    if (room.status === "finished") {
      reaperModalShownRef.current = false;
      sessionStorage.removeItem(`reaper-headstart-shown-${code}`);
      return;
    }
    if (room.status !== "waiting" && room.status !== "countdown") return;
    const key = `reaper-headstart-shown-${code}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    reaperModalShownRef.current = true;
    setShowReaperModal(true);
  }, [code, room?.status, room?.deathModeWpm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Betting state ────────────────────────────────────────────────────────
  const qcBet = useQueryClient();
  const [showBetModal, setShowBetModal] = useState(false);

  // ── Chest reward inline-card state ───────────────────────────────────────
  // chestAwarded comes in from the server the moment the sprint ends, but we
  // no longer auto-pop the chest modal on top of the results screen — instead
  // the results screen renders an inline card with Open Now / Save buttons,
  // and we only mount the cinematic modal once the user picks Open Now.
  const [chestOpenRequested, setChestOpenRequested] = useState(false);

  // Show modal once per *sprint instance*. Reset the flag when the room
  // transitions into "finished" so a restart re-prompts.
  const lastStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!code || !room) return;
    const prev = lastStatusRef.current;
    lastStatusRef.current = room.status;
    if (room.status === "finished") {
      sessionStorage.removeItem(`bet-shown-${code}`);
      return;
    }
    if (room.status !== "waiting" && room.status !== "countdown") return;
    // Re-show on (a) first entry, or (b) after a restart (prev was finished).
    const key = `bet-shown-${code}`;
    if (sessionStorage.getItem(key) && prev !== "finished") return;
    sessionStorage.setItem(key, "1");
    if (isSignedIn) setShowBetModal(true);
  }, [code, room?.status, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  type BetSummaryResp = {
    totalPot: number;
    bettorCount: number;
    myBet: number | null;
    myStatus: "active" | "won" | "lost" | "refunded" | null;
    myPayout: number | null;
    status: "open" | "closed" | "settled";
  };

  const { data: betSummary } = useQuery<BetSummaryResp>({
    queryKey: ["roomBets", code],
    queryFn: async () => {
      const r = await authedFetch(`${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api/rooms/${code}/bets`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!code,
    // Keep polling while waiting/countdown so the pot stays current, and
    // briefly after sprint ends until settlement arrives (server settles
    // bets *after* broadcasting sprint_ended, so the client must poll for it).
    refetchInterval: (q) => {
      const data = q.state.data;
      if (room?.status === "waiting" || room?.status === "countdown") return 5000;
      if (room?.status === "finished" && data?.myStatus === "active") return 1500;
      return false;
    },
    staleTime: 1500,
  });

  // Derive outcome from the polled summary OR fall back to the WS message
  // (WS message rarely arrives because the client closes on sprint_ended).
  const derivedBetOutcome = useMemo(() => {
    if (betOutcome) return betOutcome;
    if (
      betSummary?.myBet != null &&
      betSummary.myStatus &&
      betSummary.myStatus !== "active" &&
      betSummary.myPayout != null
    ) {
      return {
        outcome: betSummary.myStatus,
        stake: betSummary.myBet,
        payout: betSummary.myPayout,
      };
    }
    return null;
  }, [betOutcome, betSummary]);

  // Once we observe a settled state, refresh the coin balance.
  const settledOnceRef = useRef(false);
  useEffect(() => {
    if (
      betsSettledTick > 0 ||
      (betSummary?.status === "settled" && !settledOnceRef.current)
    ) {
      settledOnceRef.current = true;
      qcBet.invalidateQueries({ queryKey: ["coinBalance"] });
    }
  }, [betsSettledTick, betSummary?.status, qcBet]);

  useEffect(() => {
    if (!code || !name) setLocation("/");
  }, [code, name, setLocation]);

  // ── Toast when server restored previous word count ───────────────────
  useEffect(() => {
    if (!restoredWordCount) return;
    toast({
      title: "Progress restored",
      description: `Your previous ${restoredWordCount} words have been recovered — continue right where you left off.`,
    });
  }, [restoredWordCount, toast]);


  // ── Seed contenteditable with localStorage content once the div is in the DOM
  // The component does an early return when !room, so textareaRef is null on the
  // very first render.  We watch participantId (set at the same time as room) so
  // the effect retries after the room loads and the div is actually mounted.
  useLayoutEffect(() => {
    const div = textareaRef.current;
    if (!div) { textareaInitDoneRef.current = false; return; }
    if (textareaInitDoneRef.current) return; // div not in DOM yet — will retry when participantId changes
    textareaInitDoneRef.current = true;
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* ignore */ }
    if (!text) {
      const p = document.createElement("p");
      applyModeToP(p, writingStyle.paragraphMode);
      p.innerHTML = "<br>";
      div.innerHTML = "";
      div.appendChild(p);
    } else {
      // Convert legacy <br>-based content to <p> elements; leave <p>-based content as-is
      div.innerHTML = text.includes("<p")
        ? text
        : text.split(/<br\s*\/?>/gi).map(s => `<p>${s || "<br>"}</p>`).join("");
    }
    setWordCount(countWords(editorPlainText(div)));
    // Cursor to end
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(div);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  // text is intentionally omitted: we only want the stored value, not re-init on keystrokes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, room?.status]); // participantId defined ⟹ room loaded ⟹ div now in DOM

  useEffect(() => { currentTextRef.current = text; }, [text]);
  useEffect(() => { currentCapsulesRef.current = capsules; }, [capsules]);

  // ── Capture baseline when sprint starts ───────────────────────────────
  // Persist the sprint-start baseline to localStorage so a page refresh
  // (or full restart of the room from a fresh tab) can RECOVER it. Without
  // this, the "server lost our count" branch below used to set baseline=0
  // and credit the ENTIRE editor — including warm-up text — as sprint
  // words, inflating the player's word count on every refresh.
  const baselineLsKey = code ? demoStorageKey(`sprint-baseline-v1-${code}`) : "";
  useLayoutEffect(() => {
    if (!room) return;
    if (prevStatusRef.current !== "running" && room.status === "running") {
      // Play chime on genuine sprint start — skip on page-refresh reconnect (prevStatus===null)
      if (prevStatusRef.current !== null) playStartSound();

      const restored = restoredNetWordsRef.current;
      // Use textContent (plain text) not innerHTML so HTML tags aren't
      // counted as words and the baseline is accurate on retry.
      const currentTotalWords = textareaRef.current ? countWords(editorPlainText(textareaRef.current)) : 0;

      // Try to recover a previously-captured baseline from localStorage.
      // Lives across page refreshes; cleared on sprint-end (see effect below).
      let storedBaseline: number | null = null;
      if (baselineLsKey) {
        try {
          const raw = localStorage.getItem(baselineLsKey);
          if (raw !== null) {
            const parsed = parseInt(raw, 10);
            if (Number.isFinite(parsed)) storedBaseline = parsed;
          }
        } catch { /* localStorage disabled — fall through */ }
      }

      baselineWordCountRef.current = recoverWritingBaseline({
        totalWords: currentTotalWords,
        restoredWords: restored,
        storedBaseline,
        hasLocalDraft: !!currentTextRef.current,
        freshSprint: prevStatusRef.current !== null,
      });
      sprintWasRunningRef.current = true;
      const net = sprintWords(currentTotalWords, baselineWordCountRef.current, true);
      // Do not overwrite a cloud-only draft with an empty editor before restore.
      if (currentTextRef.current || prevStatusRef.current !== null) {
        sendTextUpdate(currentTextRef.current, net);
      }
      if (baselineLsKey) {
        try { localStorage.setItem(baselineLsKey, String(baselineWordCountRef.current)); } catch { /* storage unavailable */ }
      }
      // Ref changes must be reflected before paint: warm-up words must never
      // briefly put this car ahead of the starting line.
      refreshBaseline(value => value + 1);
    }
    // Clear the stored baseline once the sprint actually finishes so a future
    // sprint in the same browser doesn't pick up a stale value.
    if (prevStatusRef.current === "running" && room.status === "finished" && baselineLsKey) {
      try { localStorage.removeItem(baselineLsKey); } catch { /* ignore */ }
    }
    prevStatusRef.current = room.status;
  }, [room?.status, sendTextUpdate, baselineLsKey]);

  // ── Client-side elapsed clock for smooth reaper movement ─────────────
  // The server sends timeLeft roughly every second; interpolating client-side
  // makes the reaper line advance at a visually constant pace.
  useEffect(() => {
    if (!room || room.status !== "running") {
      // Don't reset while on the Game Over screen — the spectate panel still
      // needs a valid elapsed time to position the reaper correctly.
      if (!isGameOver) {
        sprintStartedAtRef.current = null;
        setClientElapsedMs(0);
      }
      return;
    }
    // Estimate sprint start from server's timeLeft the first time we see "running"
    if (sprintStartedAtRef.current === null) {
      const serverElapsed = room.timeLeft != null
        ? Math.max(0, room.durationMinutes * 60 - room.timeLeft) * 1000
        : 0;
      sprintStartedAtRef.current = Date.now() - serverElapsed;
      setClientElapsedMs(serverElapsed);
    }
    const interval = setInterval(() => {
      if (sprintStartedAtRef.current != null) {
        setClientElapsedMs(Date.now() - sprintStartedAtRef.current);
      }
    // 250 ms: still smooth enough for reaper movement and the timer display
    // (4 updates/sec vs the old 6.7), saves ~7 200 renders over a 30-min sprint.
    }, 250);
    return () => clearInterval(interval);
  // Re-run when status changes or game-over state changes (to avoid resetting
  // clientElapsedMs while the spectate panel is still active).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, isGameOver]);

  // Keep the lifecycle effect stable as authentication and participant state
  // resolve; an effect cleanup during admission must not save a blank editor.
  const lifecycleRef = useRef({ flushAutoSave, serverSaveNow, participantId });
  lifecycleRef.current = { flushAutoSave, serverSaveNow, participantId };

  // ── Crash protection ──────────────────────────────────────────────────
  useEffect(() => {
    closedRef.current = false;
    if (!code) return;
    const flushAll = () => {
      if (autoSaveTimeoutRef.current) { clearTimeout(autoSaveTimeoutRef.current); autoSaveTimeoutRef.current = null; }
      // Composition text can be visible before compositionend fires. Preserve
      // that DOM snapshot when switching apps or leaving the page.
      const liveEditor = textareaRef.current;
      if (liveEditor && (hasEditedRef.current || isComposingRef.current || currentTextRef.current)) currentTextRef.current = liveEditor.innerHTML;
      lifecycleRef.current.flushAutoSave(true);
      try { saveCapsules(code, currentCapsulesRef.current); } catch { /* ignore */ }
    };
    const onBeforeUnload = () => flushAll();
    const onPageHide = () => flushAll();
    const onVisibility = () => { if (document.visibilityState === "hidden") flushAll(); };
    const onBlur = () => flushAll();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      flushAll();
      closedRef.current = true;
      for (const timer of [debounceTimeoutRef, autoSaveTimeoutRef, serverSaveTimeoutRef, raceThrottleRef, capsuleFlashTimeoutRef, idleTimerRef]) {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (hasEditedRef.current) {
        const total = countWords(plainTextFromHtml(currentTextRef.current));
        const finalCount = roomRef.current?.status === "finished"
          ? roomRef.current.participants.find(p => p.id === lifecycleRef.current.participantId)?.wordCount ?? 0
          : sprintWords(total, baselineWordCountRef.current, roomRef.current?.status === "running");
        lifecycleRef.current.serverSaveNow(currentTextRef.current, finalCount, true);
      }
    };
  }, [code]);

  // ── Death Mode grace countdown ────────────────────────────────────────
  // Compute a safe "am I eliminated" value using optional chaining so it can
  // live before the early returns and be used as a real effect dependency.
  const _deathWpm = room?.deathModeWpm ?? null;
  const _myWC = room?.participants.find((p) => p.id === participantId)?.wordCount ?? 0;
  const _wordGoal = room?.wordGoal ?? null;
  const _durMin = room?.durationMinutes ?? 0;
  // Use smooth client-side elapsed time for reaper position.
  // Subtract the chosen headstart so the reaper doesn't move for that many seconds.
  const _reaperEarlyWC = _deathWpm != null && room?.status === "running"
    ? Math.floor(_deathWpm * Math.max(0, clientElapsedMs / 1000 - reaperHeadstart) / 60)
    : 0;
  // Schmitt-trigger so sitting exactly on the reaper line doesn't strobe the
  // warning. You're "caught" the moment you fall behind, but the warning only
  // clears once you pull REAPER_ESCAPE_MARGIN words clear — not the instant you
  // tie. Without this, myWC and the reaper's word count cross back and forth
  // every keystroke right at the line, flickering the banner on and off.
  const REAPER_ESCAPE_MARGIN = 5;
  const reaperCaughtRef = useRef(false);
  const _reachedGoal = _myWC >= (_wordGoal ?? _durMin * 200);
  let isEliminatedEarly: boolean;
  if (_reaperEarlyWC <= 0 || _reachedGoal) {
    isEliminatedEarly = false;
  } else if (reaperCaughtRef.current) {
    // Already caught — stay caught until clearly ahead of the reaper.
    isEliminatedEarly = _myWC < _reaperEarlyWC + REAPER_ESCAPE_MARGIN;
  } else {
    // Not yet caught — trip the moment the reaper draws level.
    isEliminatedEarly = _myWC < _reaperEarlyWC;
  }
  reaperCaughtRef.current = isEliminatedEarly;
  // Ref so interval callback always reads the latest value without stale closure
  const isEliminatedRef = useRef(false);
  isEliminatedRef.current = isEliminatedEarly;

  useEffect(() => {
    if (isGameOver) return;
    if (!isEliminatedEarly) {
      if (eliminationStartedRef.current) {
        eliminationStartedRef.current = false;
        setGraceCountdown(null);
      }
      return;
    }
    if (eliminationStartedRef.current) return;
    eliminationStartedRef.current = true;

    // Snapshot how many seconds the writer survived
    const elapsed = Math.floor(clientElapsedMs / 1000);
    setSurvivedSeconds(elapsed);

    let count = 3;
    setGraceCountdown(count);

    const interval = setInterval(() => {
      if (!isEliminatedRef.current) {
        clearInterval(interval);
        eliminationStartedRef.current = false;
        setGraceCountdown(null);
        return;
      }
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setGraceCountdown(null);
        setIsGameOver(true);
      } else {
        setGraceCountdown(count);
      }
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEliminatedEarly, isGameOver]);

  // ── Final capsule on sprint end ───────────────────────────────────────
  useEffect(() => {
    if (room?.status !== "finished" || !code) return;
    if (finalSnapshotTakenRef.current) return;
    finalSnapshotTakenRef.current = true;
    flushAutoSave();
    const finalHtml = currentTextRef.current;
    const finalPlain = textareaRef.current ? editorPlainText(textareaRef.current) : plainTextFromHtml(finalHtml);
    const finalWords = countWords(finalPlain);
    // Flush to server immediately on sprint end. CRITICAL: send the NET
    // word count (sprint-only), not the absolute page count — otherwise
    // we overwrite the server's correct in-memory net count with one that
    // includes warm-up text, inflating saved word counts and ranking.
    const finalNetWords = sprintWasRunningRef.current
      ? Math.max(0, finalWords - baselineWordCountRef.current)
      : room.participants.find(p => p.id === participantId)?.wordCount ?? 0;
    if (sprintWasRunningRef.current) serverSaveNow(finalHtml, finalNetWords);
    // Credit sprint words to the Folio daily word goal counter.
    if (sprintWasRunningRef.current && finalNetWords > 0) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const storedDate = localStorage.getItem(demoStorageKey("folio_daily_date")) || "";
        const prevWords = storedDate === today
          ? parseInt(localStorage.getItem(demoStorageKey("folio_daily_words")) || "0", 10)
          : 0;
        localStorage.setItem(demoStorageKey("folio_daily_date"), today);
        localStorage.setItem(demoStorageKey("folio_daily_words"), String(prevWords + finalNetWords));
      } catch { /* storage unavailable */ }
    }
    if (!finalHtml) return;
    setCapsules((prev) => {
      const filtered = prev.filter((c) => !c.isFinal);
      const next: Capsule[] = [...filtered, { wordCount: finalWords, savedAt: Date.now(), text: finalHtml, isFinal: true }];
      currentCapsulesRef.current = next;
      scheduleIdle(() => { if (!closedRef.current) saveCapsules(code, currentCapsulesRef.current); });
      return next;
    });
  }, [room?.status, code, flushAutoSave, serverSaveNow]);

  // ── Auto-download + auto-save to My Files when sprint ends ──────────
  useEffect(() => {
    if (room?.status === "waiting") {
      // New sprint starting — allow auto-download to fire again
      hasAutoDownloadedRef.current = false;
      setSavedToMyFiles(false);
      return;
    }
    if (room?.status !== "finished") return;
    if (hasAutoDownloadedRef.current) return;
    const plainText = textareaRef.current?.innerText?.trim() ?? "";
    if (!plainText) return;
    hasAutoDownloadedRef.current = true;
    downloadWriting();
    saveToMyFiles();
  }, [room?.status, downloadWriting, saveToMyFiles]);

  // ── Typewriter mode: lock editor height + add internal padding ───────
  // The editor is flex-1 in an unconstrained column, so padding applied to it
  // directly expands the whole page. Fix: snapshot the current visual height and
  // pin it (flex:none + explicit height) so the padding lives INSIDE the box and
  // overflow-auto scrolls it rather than the page growing.
  useEffect(() => {
    const div = textareaRef.current;
    if (!div) return;
    if (!writingStyle.typewriterMode) {
      div.style.height = "";
      div.style.flex = "1";
      div.style.paddingTop = "20px";
      div.style.paddingBottom = "20px";
      return;
    }
    // Keep the current writing area exactly the same size when toggling.
    const h = Math.max(1, div.getBoundingClientRect().height);
    div.style.height = `${h}px`;
    div.style.flex = "none";
    const pad = Math.floor(h * 0.45);
    div.style.paddingTop = `${pad}px`;
    div.style.paddingBottom = `${pad}px`;
    // Scroll so cursor is already centred when mode turns on
    const timer = setTimeout(scrollToCursor, 50);
    return () => clearTimeout(timer);
  }, [writingStyle.typewriterMode, scrollToCursor]);

  // ── Core text update ──────────────────────────────────────────────────
  // When called with an html string, sets the editor content first (for
  // programmatic restores / clears). When called with no args, just reads
  // the current editor content and syncs all state (used from handleInput,
  // handleFormat, handleKeyDown after execCommand).

  const applyText = useCallback((newHtml?: string, keepBaseline = false, restoreOnly = false) => {
    const div = textareaRef.current;
    if (!div) return;

    // Native editing can produce bare text or <div> blocks (paste, undo, IME).
    // Never replace those nodes during input: doing so discards valid writing.
    if (newHtml !== undefined) {
      // Programmatic update — set innerHTML and move cursor to end
      div.innerHTML = newHtml || "<p><br></p>";
      if (!newHtml) applyModeToP(div.firstElementChild as HTMLElement, paragraphModeRef.current);
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(div);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    // Read from the live DOM (handles both user-typed and programmatic content)
    const html = div.innerHTML;
    // Use innerHTML → replace <br> with spaces so words separated by Enter are
    // counted correctly (textContent collapses br to nothing, merging words).
    const plainText = editorPlainText(div);
    const wc = countWords(plainText);
    currentTextRef.current = html;
    setText(html);
    setWordCount(wc);
    if (restoreOnly) {
      const restoredNet = roomRef.current?.status === "finished"
        ? roomRef.current.participants.find(p => p.id === participantId)?.wordCount ?? 0
        : sprintWords(wc, baselineWordCountRef.current, roomRef.current?.status === "running");
      setLatestText(html, restoredNet);
      if (roomRef.current?.status === "running") sendTextUpdate(html, restoredNet);
      setSaveStatus("cloud");
      return;
    }
    setSaveStatus("unsaved");
    setSavedToMyFiles(false);
    hasEditedRef.current = true;

    // ── HUD fade: mark as typing, reset idle timer (2 s) ─────────────────
    if (newHtml === undefined) { // only on user input, not programmatic restores
      setIsTyping(true);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => setIsTyping(false), 2000);
    }

    // If the user wiped the editor clean during a sprint, reset the baseline
    // so the car/counter starts from 0 again when they resume typing.
    // keepBaseline=true skips this so "Chapter Finished" clears the box
    // without resetting the car position.
    if (wc === 0 && roomRef.current?.status === "running" && !keepBaseline) {
      baselineWordCountRef.current = Math.min(0, baselineWordCountRef.current);
      try { localStorage.setItem(baselineLsKey, String(baselineWordCountRef.current)); } catch { /* storage unavailable */ }
      lastCapsuleThresholdRef.current = 0;
    }

    // Net words = words typed SINCE sprint started (baseline subtracted)
    const netWc = sprintWords(wc, baselineWordCountRef.current, roomRef.current?.status === "running");
    setLatestText(html, netWc);

    // Optimistic car movement — throttled to 200 ms so mobile doesn't
    // re-render Framer Motion on every keystroke.  The car's 0.6 s transition
    // makes the gap invisible.  PC users see no difference.
    pendingNetWcRef.current = netWc;
    if (!raceThrottleRef.current) {
      raceThrottleRef.current = window.setTimeout(() => {
        raceThrottleRef.current = null;
        // Only push optimistic update while the sprint is actively running —
        // firing after sprint_ended would overwrite the server's final results.
        if (participantId && roomRef.current?.status === "running") {
          updateLocalWordCount(participantId, pendingNetWcRef.current);
        }
      }, 200);
    }

    // ── Goal mode: prompt when target first reached during a sprint ───────
    if (wordGoalRef.current !== null && netWc >= wordGoalRef.current && !goalHitShownRef.current) {
      goalHitShownRef.current = true;
      setGoalDialogOpen(true);
    }

    // ── Time Capsule: snapshot every CAPSULE_INTERVAL words ──────────────
    const nextThreshold = lastCapsuleThresholdRef.current + CAPSULE_INTERVAL;
    if (wc >= nextThreshold) {
      const crossedThreshold = Math.floor(wc / CAPSULE_INTERVAL) * CAPSULE_INTERVAL;
      lastCapsuleThresholdRef.current = crossedThreshold;
      const newCapsule: Capsule = { wordCount: crossedThreshold, savedAt: Date.now(), text: html };
      setCapsules((prev) => {
        const filtered = prev.filter((c) => c.wordCount !== crossedThreshold);
        const updated = [...filtered, newCapsule];
        // Defer the localStorage write so it never blocks the keystroke
        currentCapsulesRef.current = updated;
        scheduleIdle(() => { if (!closedRef.current) saveCapsules(code, currentCapsulesRef.current); });
        return updated;
      });
      setCapsuleFlash(true);
      if (capsuleFlashTimeoutRef.current) clearTimeout(capsuleFlashTimeoutRef.current);
      capsuleFlashTimeoutRef.current = window.setTimeout(() => setCapsuleFlash(false), 2200);
    }

    // Debounced server sync (pass net word count so server uses correct value)
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = window.setTimeout(() => sendTextUpdate(html, netWc), 100);

    // 400ms debounced autosave to localStorage (status updated inside flushAutoSave)
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => flushAutoSave(), 400);

    // 5s debounced server backup
    scheduleServerSave(html, netWc);
  }, [code, baselineLsKey, participantId, setLatestText, sendTextUpdate, updateLocalWordCount, flushAutoSave, scheduleServerSave]);

  // ── Chapter Finished ───────────────────────────────────────────────────
  const handleChapterFinished = useCallback(() => {
    const chapterText = textareaRef.current ? editorPlainText(textareaRef.current) : plainTextFromHtml(currentTextRef.current);
    if (!chapterText.trim()) return;

    // Download with chapter number in filename
    const chapterNum = chapterCountRef.current;
    const blob = new Blob([chapterText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chapter-${chapterNum}-sprint-${code}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    // Adjust baseline BEFORE clearing so the net word count stays the same.
    // Math: netWc = max(0, wc - baseline). After clear wc=0, so baseline = -netWc.
    const currentNetWc = sprintWords(countWords(chapterText), baselineWordCountRef.current, roomRef.current?.status === "running");
    baselineWordCountRef.current = -currentNetWc;
    try { localStorage.setItem(baselineLsKey, String(-currentNetWc)); } catch { /* storage unavailable */ }

    // Clear the box — keepBaseline=true prevents the wipe-reset guard from
    // zeroing the baseline we just set above, so the car position is preserved.
    applyText("", true);

    // Immediately tell the server: empty text but same word count, so a rejoin
    // won't restore the cleared chapter text from the backup
    serverSaveNow("", currentNetWc);

    chapterCountRef.current += 1;

    toast({
      title: `Chapter ${chapterNum} saved`,
      description: "Downloaded and cleared. Your sprint word count continues from here.",
    });
  }, [wordCount, code, baselineLsKey, applyText, serverSaveNow, toast]);

  // Restore only after the real editor exists; a slow response must never
  // replace writing that the user has started in the meantime.
  useEffect(() => {
    if (!code || !name || !participantId || !textareaRef.current || serverRestoreDoneRef.current) return;
    if (currentTextRef.current || hasEditedRef.current) {
      serverRestoreDoneRef.current = true;
      // A reload may happen before the previous debounce reached the server.
      // Resume backup of the local draft even if the writer does not type again.
      // Completed sprints retain their authoritative server result.
      if (currentTextRef.current && !hasEditedRef.current && roomRef.current?.status !== "finished") {
        const total = countWords(plainTextFromHtml(currentTextRef.current));
        serverSaveNow(currentTextRef.current, sprintWords(total, baselineWordCountRef.current, roomRef.current?.status === "running"));
      }
      return;
    }
    let cancelled = false;
    authedFetch(`/api/rooms/${encodeURIComponent(code)}/writing/${encodeURIComponent(name)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        serverRestoreDoneRef.current = true;
        if (typeof data?.text !== "string" || currentTextRef.current || hasEditedRef.current || !textareaRef.current) return;
        const total = countWords(plainTextFromHtml(data.text));
        if (roomRef.current?.status === "running") {
          // The live room is authoritative, including an intentional zero
          // after a restart; an older HTTP backup must not revive that score.
          const recoveredWords = roomRef.current.participants.find(p => p.id === participantId)?.wordCount
            ?? (Number.isFinite(data.wordCount) ? Math.max(0, data.wordCount) : 0);
          baselineWordCountRef.current = total - recoveredWords;
          try { localStorage.setItem(baselineLsKey, String(baselineWordCountRef.current)); } catch { /* storage unavailable */ }
        }
        applyText(data.text, true, true);
        flushAutoSave(true);
        setSaveStatus("cloud");
        if (data.text) toast({ title: "Writing restored", description: "Your previous writing has been recovered from the server." });
      })
      .catch(() => { /* keep the local fallback; a later reconnect can retry */ });
    return () => { cancelled = true; };
  }, [code, name, participantId, room?.status, baselineLsKey, authedFetch, applyText, flushAutoSave, serverSaveNow, toast]);

  // ── Goal mode: reset hit-flag when a new sprint starts ─────────────────
  useEffect(() => {
    if (room?.status === "running") goalHitShownRef.current = false;
  }, [room?.status]);

  // ── Exit distraction-free mode when sprint ends ───────────────────────
  useEffect(() => {
    if (room?.status === "finished") setDistractionFree(false);
  }, [room?.status]);

  // ── Award XP when sprint finishes (signed-in users only) ─────────────
  useEffect(() => {
    if (!room || room.status !== "finished" || !isSignedIn || xpAwardedRef.current) return;
    xpAwardedRef.current = true;

    const myWc = room.participants.find((p) => p.id === participantId)?.wordCount ?? 0;
    if (myWc <= 0) return;

    const sorted = [...room.participants].sort((a, b) => b.wordCount - a.wordCount);
    const isFirstPlace = sorted[0]?.id === participantId;

    authedFetch(`${basePath}/api/user/xp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFirstPlace, roomCode: code }),
    })
      .then((r) => r.json())
      .then((data: { xpGained?: number }) => {
        if (typeof data.xpGained === "number") setXpGained(data.xpGained);
      })
      .catch(() => { /* silent */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, isSignedIn, participantId]);

  // ── Handlers ─────────────────────────────────────────────────────────

  // User typing in the contenteditable editor — just sync from current DOM state
  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    applyText();
    if (writingStyle.typewriterMode) requestAnimationFrame(scrollToCursor);
  }, [applyText, writingStyle.typewriterMode, scrollToCursor]);

  const handleEditorFocus = useCallback(() => {
    const div = textareaRef.current;
    if (!div) return;
    // Ensure editor always has at least one <p> to type into, with inline
    // spacing styles matching the current mode so line 0 behaves identically
    // to every subsequent paragraph created by insertParagraphAtCursor.
    if (!div.textContent && !div.querySelector("p")) {
      const p = document.createElement("p");
      applyModeToP(p, writingStyle.paragraphMode);
      p.innerHTML = "<br>";
      div.innerHTML = "";
      div.appendChild(p);
      const sel = window.getSelection();
      if (sel) {
        const r = document.createRange();
        r.setStart(p, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
  }, [writingStyle.paragraphMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Let the browser own paragraphs, Shift+Enter, undo and composition.
    // Direct Range mutations on Enter used to break undo and IME input.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") setDistractionFree(false);
  }, []);

  // Strip pasted HTML — keep only the plain text
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const plain = e.clipboardData.getData("text/plain");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand("insertText", false, plain);
    applyText();
  }, [applyText]);

  const handleStyleChange = (partial: Partial<WritingStyle>) => {
    if (partial.paragraphMode && textareaRef.current) {
      textareaRef.current.querySelectorAll("p").forEach(p => {
        applyModeToP(p, partial.paragraphMode!);
      });
    }
    setWritingStyle((prev) => {
      const next = { ...prev, ...partial };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Track which inline formats are active at the current selection so the
  // toolbar's B/I/U chips can light up. queryCommandState is the standard
  // way to read this from a contentEditable region.
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });

  const refreshActiveFormats = useCallback(() => {
    const div = textareaRef.current;
    if (!div) return;
    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    const inEditor = !!anchor && div.contains(
      anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement,
    );
    // When the selection isn't inside our editor, clear the chips instead
    // of leaving them stuck on the previous editor state.
    if (!inEditor) {
      setActiveFormats({ bold: false, italic: false, underline: false });
      return;
    }
    savedSelectionRef.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    try {
      setActiveFormats({
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        bold: document.queryCommandState("bold"),
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        italic: document.queryCommandState("italic"),
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        underline: document.queryCommandState("underline"),
      });
    } catch {
      /* ignore — older browsers without queryCommandState */
    }
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActiveFormats);
    return () => document.removeEventListener("selectionchange", refreshActiveFormats);
  }, [refreshActiveFormats]);

  const handleFormat = useCallback((type: FormatType) => {
    const div = textareaRef.current;
    if (!div || !div.isContentEditable) return;
    div.focus();
    const selection = window.getSelection();
    const saved = savedSelectionRef.current;
    if (saved && div.contains(saved.commonAncestorContainer)) {
      selection?.removeAllRanges();
      selection?.addRange(saved);
    }
    const command = type === "bold" ? "bold" : type === "italic" ? "italic" : "underline";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false, undefined);
    applyText();
    refreshActiveFormats();
  }, [applyText, refreshActiveFormats]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code)
      .then(() => toast({ title: "Copied!", description: "Room code copied to clipboard." }))
      .catch(() => toast({ title: "Room code", description: code }));
  };

  useEffect(() => {
    if (room?.status === "waiting" || room?.status === "countdown") setGladiatorResultDismissed(false);
  }, [room?.status]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setDistractionFree(value => !value);
      }
      if (event.key === "Escape") setDistractionFree(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!actionError) return;
    toast({ title: "Action unavailable", description: actionError });
    clearActionError();
  }, [actionError, clearActionError, toast]);

  useEffect(() => {
    if (room?.status !== "waiting") return;
    finalSnapshotTakenRef.current = false;
    sprintWasRunningRef.current = false;
    xpAwardedRef.current = false;
    restoredNetWordsRef.current = 0;
    eliminationStartedRef.current = false;
    hasAutoDownloadedRef.current = false;
    goalHitShownRef.current = false;
    setIsGameOver(false);
    setReadMode(false);
    setGraceCountdown(null);
    setXpGained(null);
    setChestOpenRequested(false);
    setGoalDialogOpen(false);
  }, [room?.status]);

  // ── Render ────────────────────────────────────────────────────────────

  if (error) {
    const isFinishedError = error.toLowerCase().includes("finished");
    const isRoomGone = error === "Room not found";
    const isArenaFull = error.toLowerCase().includes("arena is full");
    const canRejoin = !isFinishedError && !isRoomGone && !isArenaFull && code && name;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className={`max-w-md ${isArenaFull ? "border-red-700 bg-red-950/60 text-red-200" : ""}`}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isFinishedError ? "Sprint Ended" : isRoomGone ? "Room No Longer Available" : isArenaFull ? "⚔️ The Arena Is Full" : "Connection Error"}
          </AlertTitle>
          <AlertDescription className="space-y-4 mt-2">
            <p>
              {isFinishedError
                ? "This sprint has already finished. Your writing is safely saved."
                : isRoomGone
                ? "This room has expired or been closed. Rooms only last while the session is active — once everyone leaves or the server restarts, the room is gone. Your writing was saved and you can download it from home."
                : isArenaFull
                ? "Two gladiators have already entered this arena. Gladiator Mode is strictly 1v1 — only two fighters may compete at a time. Create your own arena from the home screen."
                : error}
            </p>
            <div className="flex flex-col gap-2">
              {canRejoin && (
                <Button
                  variant="default"
                  onClick={() => {
                    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}${sprintRole === "editor" ? "&role=editor" : ""}${isCreatorParams ? "&isCreator=true" : ""}`);
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  Rejoin Room
                </Button>
              )}
              <Button variant="outline" onClick={() => setLocation("/")} className="w-full">Return Home</Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-muted-foreground space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Connecting to sprint room…</p>
      </div>
    );
  }

  // Game over — show the death screen instead of the sprint room
  if (isGameOver) {
    const goWC = room.participants.find((p) => p.id === participantId)?.wordCount ?? 0;
    const goReaper = room.deathModeWpm != null
      ? Math.floor(room.deathModeWpm * Math.max(0, clientElapsedMs / 1000 - reaperHeadstart) / 60)
      : null;
    return (
      <GameOverScreen
        wordsWritten={goWC}
        survivedSeconds={survivedSeconds}
        room={room}
        currentParticipantId={participantId}
        reaperWordCount={goReaper}
        text={text}
        capsules={capsules}
      />
    );
  }

  const isCreator = room.participants.find((p) => p.id === participantId)?.isCreator || isCreatorParams;
  const isRunning = room.status === "running";
  const isWaiting = room.status === "waiting";
  const isCountdown = room.status === "countdown";
  const isFinished = room.status === "finished";
  const isOpenMode = room.mode === "open";

  // Net word count: what shows on the badge and car during a sprint
  const netWordCount = isRunning ? (prevStatusRef.current === "running" ? Math.max(0, wordCount - baselineWordCountRef.current) : restoredWordCount ?? 0) : isFinished ? (room.participants.find(p => p.id === participantId)?.wordCount ?? 0) : 0;

  // Death Mode: smooth client-side reaper position (updates every 150 ms)
  const reaperWordCount = isRunning && room.deathModeWpm != null
    ? Math.floor(room.deathModeWpm * Math.max(0, clientElapsedMs / 1000 - reaperHeadstart) / 60)
    : null;

  // Seconds remaining in the headstart window (reaper hasn't started yet)
  const headstartSecsLeft = isRunning && room.deathModeWpm != null
    ? Math.max(0, Math.ceil(reaperHeadstart - clientElapsedMs / 1000))
    : 0;
  const myParticipant = room.participants.find((p) => p.id === participantId);
  const isEliminated = reaperWordCount != null && myParticipant != null
    && myParticipant.wordCount < reaperWordCount
    && myParticipant.wordCount < (room.wordGoal ?? room.durationMinutes * 200);

  // Sync to ref so the grace countdown interval can read it without stale closure
  isEliminatedRef.current = isEliminated;
  // Keep refs in sync so intervals/callbacks can read them without stale closures
  netWordCountRef.current = netWordCount;
  wordGoalRef.current = room.wordGoal ?? null;
  roomRef.current = room;
  if (restoredWordCount != null) restoredNetWordsRef.current = restoredWordCount;

  // Format countdown seconds as mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0
      ? `${m}:${String(s).padStart(2, "0")}`
      : `0:${String(s).padStart(2, "0")}`;
  };

  // In open mode, show everyone's live text except our own car
  const otherParticipants = room.participants.filter((p) => p.id !== participantId);

  return (
    <>
    <EmoteOverlay emotes={activeEmotes} currentParticipantId={participantId} />
    <StickyNote
      open={stickyOpen}
      onClose={() => setStickyOpen(false)}
      noteKey={`room_${code}`}
      title={`Notes · ${code}`}
    />
    {/* Fixed background layers — only shown in normal (non-distraction-free) mode */}
    {!distractionFree && <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "var(--bg-solid)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(var(--bg-grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--bg-grid-color) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", background: "var(--bg-orb1)", filter: "blur(90px)", top: -80, right: -80, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 300, height: 300, borderRadius: "50%", background: "var(--bg-orb2)", filter: "blur(90px)", bottom: 0, left: 0, pointerEvents: "none", zIndex: 0 }} />
    </>}
    <div className={distractionFree
      ? "fixed inset-0 z-50 bg-background flex flex-col overflow-auto"
      : "ws-room-shell w-full flex flex-col gap-4"
    } style={!distractionFree ? { position: "relative", zIndex: 1, height: isFinished ? "auto" : "100dvh", minHeight: "100dvh", overflow: isFinished ? "visible" : "hidden", overflowX: "hidden" } : undefined}>

      {/* Chest award modal — only mounted once the user clicks "Open Now" on
          the inline chest card embedded in the results screen. autoOpen=true
          skips the redundant "Chest Earned!" preview screen since the inline
          card already served that role. */}
      {chestAwarded && chestOpenRequested && (
        <ChestAwardModal
          chestType={chestAwarded}
          autoOpen
          onClose={() => {
            setChestAwarded(null);
            setChestOpenRequested(false);
          }}
        />
      )}

      {/* Bet modal — shown once on entry while sprint is still in waiting/countdown */}
      {showBetModal && code && (room?.status === "waiting" || room?.status === "countdown") && (
        <BetModal roomCode={code} onClose={() => setShowBetModal(false)} />
      )}

      {/* Gladiator execution / victory / draw overlay */}
      {room?.mode === "gladiator" && gladiatorState.executionResult && !gladiatorResultDismissed && (
        <GladiatorResults result={gladiatorState.executionResult} participantId={participantId} onClose={() => setGladiatorResultDismissed(true)} />
      )}

      {/* Reconnecting banner — fixed overlay so it never shifts the writing
          area. Only shown after a 2-second grace period so brief blips are
          invisible to the writer. */}
      {showReconnectBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-full shadow-lg px-4 py-2 text-sm font-medium pointer-events-none">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {disconnectReason === "server_restart"
              ? "Server restarted — reconnecting…"
              : "Reconnecting… your writing is safe."}
          </span>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        </div>
      )}

      <SkinOverlay typingSpeed={
        isRunning && clientElapsedMs > 0
          ? Math.round((netWordCountRef.current / (clientElapsedMs / 60000)))
          : 0
      } />

      {/* Grand Scribe / Ranker room banner */}
      {!distractionFree && room.creatorXp >= 25000 && (
        <div
          className="flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs font-semibold tracking-wide"
          style={
            room.creatorXp >= 200000
              ? { background: "linear-gradient(90deg, #1a0040 0%, #2d0070 50%, #1a0040 100%)", color: "#a855f7", border: "1px solid #a855f750", textShadow: "0 0 10px #a855f7aa" }
              : { background: "linear-gradient(90deg, #1a1000 0%, #302000 50%, #1a1000 100%)", color: "#f59e0b", border: "1px solid #f59e0b50", textShadow: "0 0 8px #f59e0b88" }
          }
        >
          {room.creatorXp >= 200000 ? (
            <><span>👑</span><span>Hosted by a Ranker</span></>
          ) : (
            <><span>✨</span><span>Hosted by a Grand Scribe</span></>
          )}
        </div>
      )}

      {/* Header — hidden in distraction-free mode */}
      {!distractionFree && (
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(245,242,236,0.92)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(107,143,212,0.15)",
          display: "flex", alignItems: "center", gap: 16,
          height: 56, padding: "0 20px",
        }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e" }}>Writing Sprint</span>
          <span style={{ color: "rgba(107,143,212,0.3)", fontSize: "1.2rem" }}>|</span>

          {/* Room code */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(107,143,212,0.10)", border: "1px solid rgba(107,143,212,0.2)", borderRadius: 8, padding: "4px 10px", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", color: "#1a1a2e", fontFamily: "monospace" }}>
            Room: <strong>{code}</strong>
            <button
              onClick={copyRoomCode}
              style={{ cursor: "pointer", color: "#7a7a92", background: "none", border: "none", display: "flex", alignItems: "center", padding: 0 }}
              title="Copy room code"
            >
              <Copy size={13} />
            </button>
          </div>

          {isOpenMode && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", fontWeight: 700, background: "rgba(107,143,212,0.1)", color: "#6B8FD4", padding: "3px 10px", borderRadius: 6 }}>
              <Eye size={11} /> Open
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Writer avatars + count — hover to see everyone, click any to open profile */}
            <RoomWritersDropdown
              participants={room.participants}
              onOpenProfile={(name) => setLocation(`/profile/${encodeURIComponent(name)}`)}
            />


            {/* Read / Write toggle */}
            {(isWaiting || isCountdown || isRunning || isFinished) && (
              <button
                onClick={() => {
                  setReadMode((v) => {
                    if (v) {
                      setTimeout(() => {
                        const el = textareaRef.current;
                        if (el) {
                          el.focus();
                          const range = document.createRange();
                          const sel = window.getSelection();
                          range.selectNodeContents(el);
                          range.collapse(false);
                          sel?.removeAllRanges();
                          sel?.addRange(range);
                        }
                      }, 50);
                    }
                    return !v;
                  });
                }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500, color: "#7a7a92", transition: "color 0.18s", padding: 0 }}
                title={readMode ? "Switch back to writing" : "Read what you've written"}
              >
                {readMode ? <><PenLine size={14} /><span className="hidden sm:inline">Write</span></> : <><BookOpen size={14} /><span className="hidden sm:inline">Read</span></>}
              </button>
            )}

            {/* Leave */}
            <button
              onClick={() => setLeaveDialogOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500, color: "#dc2626", transition: "color 0.18s", padding: 0 }}
            >
              <LogOut size={14} /><span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </header>
      )}

      {/* Main */}
      {isFinished ? (
        <div className="flex-1 flex items-center justify-center" style={!distractionFree ? { padding: "16px 20px" } : undefined}>
          <ResultsScreen
            participants={room.participants}
            currentParticipantId={participantId}
            isCreator={isCreator}
            onRestart={restartSprint}
            myText={text}
            capsules={capsules}
            xpGained={xpGained}
            isBossMode={room.mode === "boss"}
            bossWordGoal={room.bossWordGoal}
            bossDefeated={room.mode === "boss" && (room.bossTotalWords ?? room.participants.filter(p => p.role !== "editor").reduce((sum, p) => sum + p.wordCount, 0)) >= (room.bossWordGoal ?? Infinity)}
            isGladiatorMode={room.mode === "gladiator"}
            isKartMode={room.mode === "kart"}
            betOutcome={derivedBetOutcome}
            chestAwarded={chestAwarded}
            onOpenChest={() => setChestOpenRequested(true)}
            onSaveChest={() => setChestAwarded(null)}
          />
        </div>
      ) : (
        <div className={distractionFree ? "flex-1 flex flex-col" : "ws-room-main flex-1 flex flex-col"} style={!distractionFree ? { padding: "6px 20px 6px", minHeight: 0 } : undefined}>
          {/* Race / boss track + timer — hidden in distraction-free mode */}
          {!distractionFree && (
            <div
              style={{ maxWidth: 1100, margin: "0 auto", width: "100%", paddingTop: 2, flexShrink: 0 }}
              onMouseEnter={() => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); setIsTyping(false); }}
            >
              <div className="ws-room-game-row" style={{ display: "flex", gap: 12, alignItems: "stretch", paddingBottom: 4 }}>
                {/* Race / boss / gladiator track */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {room.mode === "gladiator" ? (
                    <>
                      {/* Arena scene — visible during waiting, countdown, and running */}
                      {(isWaiting || isCountdown || isRunning) && room.gladiatorDeathGap && (
                        <GladiatorHUD
                          state={gladiatorState}
                          deathGap={room.gladiatorDeathGap}
                          myName={myParticipant?.name ?? "You"}
                          opponentName={otherParticipants[0]?.name ?? null}
                          isRunning={isRunning}
                        />
                      )}
                    </>
                  ) : room.mode === "boss" && room.bossWordGoal ? (
                    <BossTrack
                      participants={room.participants}
                      currentParticipantId={participantId}
                      bossWordGoal={room.bossWordGoal}
                      isRunning={isRunning}
                      bossDefeated={(room.bossTotalWords ?? 0) >= room.bossWordGoal}
                    />
                  ) : (
                    <RaceTrack
                      participants={room.participants}
                      currentParticipantId={participantId}
                      durationMinutes={room.durationMinutes}
                      wordGoal={room.wordGoal}
                      reaperWordCount={reaperWordCount}
                      carOffsets={room.mode === "kart" ? kartState.carOffsets : undefined}
                      starActiveIds={room.mode === "kart" ? kartState.starActiveIds : undefined}
                      kartEffects={room.mode === "kart" ? kartState.effects : undefined}
                      isKartMode={room.mode === "kart"}
                      localWordCount={isRunning && room.mode !== "kart" ? netWordCount : undefined}
                      hostCarSkin={room.hostCarSkin}
                      hostRoadSkin={room.hostRoadSkin}
                      roomMode={room.mode}
                    />
                  )}
                  {/* Death Mode banner slot — fixed height so showing/hiding the
                      warning never shifts the editor. Previously these banners
                      lived in normal flow, so toggling them while hovering on
                      the reaper line shoved the whole page up and down, making
                      it impossible to focus. The slot reserves the space once. */}
                  {room.deathModeWpm != null && isRunning && (
                    <div style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {headstartSecsLeft > 0 ? (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          borderRadius: 12, padding: "10px 16px",
                          background: "linear-gradient(135deg, rgba(10,0,0,0.9), rgba(45,0,0,0.85))",
                          border: "1px solid rgba(180,0,0,0.5)",
                          boxShadow: "0 0 18px rgba(180,0,0,0.2)",
                          animation: "reaperPulse 2.4s ease-in-out infinite",
                        }}>
                          <span style={{ fontSize: "1.1rem", animation: "reaperFlicker 1.8s ease-in-out infinite" }}>☠️</span>
                          <span style={{ color: "#fca5a5", fontSize: "0.82rem", fontWeight: 600 }}>
                            The reaper stirs in
                          </span>
                          <span style={{
                            fontFamily: "monospace", fontWeight: 800, fontSize: "1.3rem",
                            color: "#ff4444", minWidth: 36, textAlign: "center",
                            textShadow: "0 0 10px #ff0000, 0 0 20px #ff000055",
                            animation: headstartSecsLeft <= 3 ? "reaperFlicker 0.4s ease-in-out infinite" : undefined,
                          }}>
                            {headstartSecsLeft}s
                          </span>
                        </div>
                      ) : graceCountdown !== null ? (
                        <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-red-500/70 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300">
                          <span className="text-xl tabular-nums">{graceCountdown}</span>
                          <span>The reaper caught you — keep typing or you're out!</span>
                          <span className="text-xl">💀</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Sticky inline timer — always visible while scrolling, aligns with sidebar */}
                <div className="ws-room-clock" style={{ width: 240, flexShrink: 0, display: "flex", alignItems: "stretch" }}>
                  {(() => {
                    if (isRunning || isCountdown) {
                      // Use client-interpolated time when running so the
                      // display keeps counting down even if the WebSocket
                      // misses a beat — server value is the fallback.
                      const serverSecs = isCountdown ? (room.countdownTimeLeft ?? 0) : (room.timeLeft ?? 0);
                      const secs = (!isCountdown && clientElapsedMs > 0 && room.durationMinutes)
                        ? Math.max(0, room.durationMinutes * 60 - Math.floor(clientElapsedMs / 1000))
                        : serverSecs;
                      const mm = String(Math.floor(secs / 60)).padStart(2, "0");
                      const ss = String(secs % 60).padStart(2, "0");
                      const isLow = isRunning && secs > 0 && secs <= 60;
                      const isDeathCountdown = isCountdown && room.deathModeWpm != null;
                      const isHeadstart = headstartSecsLeft > 0;
                      const headstartAlmostDone = isHeadstart && headstartSecsLeft <= 3;
                      return (
                        <div style={{
                          flex: 1,
                          background: isHeadstart || isDeathCountdown
                            ? "linear-gradient(160deg, rgba(10,0,0,0.95), rgba(50,0,0,0.9))"
                            : isLow ? "rgba(254,226,226,0.95)" : "rgba(255,255,255,0.92)",
                          backdropFilter: "blur(16px)",
                          WebkitBackdropFilter: "blur(16px)",
                          border: isHeadstart || isDeathCountdown
                            ? "1px solid rgba(180,0,0,0.6)"
                            : `1px solid ${isLow ? "rgba(220,38,38,0.25)" : "rgba(255,255,255,0.9)"}`,
                          borderRadius: 14,
                          boxShadow: isHeadstart || isDeathCountdown
                            ? "0 0 20px rgba(180,0,0,0.3), 0 4px 20px rgba(0,0,0,0.4)"
                            : "0 4px 20px rgba(107,143,212,0.08)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          padding: "8px 12px",
                          animation: isHeadstart || isDeathCountdown ? "reaperPulse 2.4s ease-in-out infinite" : undefined,
                        }}>
                          {(isHeadstart || isDeathCountdown) && (
                            <div style={{ fontSize: "1.1rem", marginBottom: 2, filter: "drop-shadow(0 0 5px #ff0000)", animation: `reaperFlicker ${headstartAlmostDone ? "0.4s" : "1.8s"} ease-in-out infinite` }}>☠️</div>
                          )}
                          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: isHeadstart ? "2.6rem" : "2.2rem", letterSpacing: "-0.04em", color: isHeadstart || isDeathCountdown ? "#ff4444" : isLow ? "#dc2626" : "#1a1a2e", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: isHeadstart || isDeathCountdown ? "0 0 12px #ff0000, 0 0 24px #ff000055" : undefined }}>
                            {isHeadstart ? `${headstartSecsLeft}s` : `${mm}:${ss}`}
                          </div>
                          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: isHeadstart || isDeathCountdown ? "#f87171" : isLow ? "#dc2626" : "#7a7a92", marginTop: 4, textAlign: "center", lineHeight: 1.3 }}>
                            {isHeadstart ? "Reaper\nstirring" : isDeathCountdown ? "Reaper\nawakens" : isLow ? "⏰ Final minute!" : isCountdown ? "Until start" : "Remaining"}
                          </div>
                        </div>
                      );
                    }
                    if (isWaiting) {
                      return (
                        <div style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.88)",
                          backdropFilter: "blur(16px)",
                          WebkitBackdropFilter: "blur(16px)",
                          border: "1px solid rgba(255,255,255,0.9)",
                          borderRadius: 14,
                          boxShadow: "0 4px 20px rgba(107,143,212,0.08)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 6, padding: "8px 12px",
                        }}>
                          <Clock size={20} style={{ color: "#6B8FD4" }} />
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#7a7a92", textAlign: "center", lineHeight: 1.4 }}>
                            Waiting to start
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}

          <div
            className={distractionFree ? "flex-1 flex flex-col px-6 md:px-24 py-4" : "ws-room-grid"}
            style={!distractionFree ? { gap: 16, flex: 1, minHeight: 0, maxWidth: 1100, margin: "0 auto", width: "100%" } : undefined}
          >

            {/* Writing area */}
            <div className={distractionFree ? "flex-1 flex flex-col max-w-3xl mx-auto w-full" : "flex flex-col h-full"} style={!distractionFree ? { minHeight: 0 } : undefined}>
              {/* Distraction-free minimal top bar */}
              {distractionFree && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                      {(() => {
                        const tl = (clientElapsedMs > 0 && room.durationMinutes)
                          ? Math.max(0, room.durationMinutes * 60 - Math.floor(clientElapsedMs / 1000))
                          : (room.timeLeft ?? null);
                        return tl != null
                          ? `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, "0")}`
                          : "--:--";
                      })()}
                    </span>
                    <span className="text-muted-foreground text-xs">|</span>
                    <span className="font-mono text-sm text-foreground">{netWordCount} <span className="text-muted-foreground font-normal text-xs">words</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReadMode((v) => !v)}
                      className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded ${readMode ? "text-foreground bg-muted/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
                      title={readMode ? "Switch back to writing" : "Read what you've written"}
                    >
                      {readMode ? <PenLine className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                      {readMode ? "Write" : "Read"}
                    </button>
                    <button
                      onClick={() => setDistractionFree(false)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/60"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      Exit focus
                    </button>
                  </div>
                </div>
              )}
              {!readMode && (
                <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: "7px 12px", boxShadow: "0 4px 20px rgba(107,143,212,0.08)", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div className="ws-toolbar-scroll" style={{ flex: 1, minWidth: 0 }}>
                    <WritingToolbar style={writingStyle} onChange={handleStyleChange} onFormat={handleFormat} activeFormats={activeFormats} />
                  </div>
                  <EmoteBar
                    participants={room.participants}
                    currentParticipantId={participantId}
                    onSend={sendEmote}
                    disabled={!isConnected}
                  />
                </div>
              )}

              {/* Warmup / countdown banner — between toolbar and editor */}
              {(isWaiting || isCountdown) && (
                isCountdown && room.deathModeWpm != null ? (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(15,0,0,0.92), rgba(60,0,0,0.85))",
                    border: "1px solid rgba(180,0,0,0.55)",
                    borderRadius: 10, padding: "10px 16px",
                    fontSize: "0.82rem", color: "#f87171",
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: 8,
                    boxShadow: "0 0 18px rgba(180,0,0,0.25), inset 0 0 30px rgba(0,0,0,0.4)",
                    animation: "reaperPulse 2.4s ease-in-out infinite",
                  }}>
                    <span style={{ fontSize: "1.2rem", filter: "drop-shadow(0 0 6px #ff0000)" }}>☠️</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "1.15rem", color: "#ff4444", letterSpacing: "0.04em", textShadow: "0 0 10px #ff0000, 0 0 20px #ff000055", minWidth: 48 }}>
                      {formatCountdown(room.countdownTimeLeft ?? 0)}
                    </span>
                    <span style={{ color: "#fca5a5", fontWeight: 600, lineHeight: 1.3 }}>
                      until the Reaper awakens —{" "}
                      <span style={{ color: "#f87171", fontStyle: "italic" }}>write while you still can</span>
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "1rem", opacity: 0.7, animation: "reaperFlicker 1.8s ease-in-out infinite" }}>🩸</span>
                  </div>
                ) : (
                  <div style={{
                    background: isCountdown
                      ? "linear-gradient(135deg, rgba(232,168,56,0.1), rgba(232,168,56,0.06))"
                      : "linear-gradient(135deg, rgba(232,168,56,0.1), rgba(232,168,56,0.06))",
                    border: `1px solid ${isCountdown ? "rgba(232,168,56,0.25)" : "rgba(232,168,56,0.2)"}`,
                    borderRadius: 10, padding: "10px 14px",
                    fontSize: "0.82rem", color: "#1a1a2e",
                    display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 8,
                  }}>
                    {isCountdown ? (
                      <>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem", color: "#a07020" }}>
                          {formatCountdown(room.countdownTimeLeft ?? 0)}
                        </span>
                        <span>until the sprint starts — warm up while you wait!</span>
                      </>
                    ) : (
                      <span>✍️ Write ahead while you wait — words written now <strong>won't count</strong> toward your score.</span>
                    )}
                  </div>
                )
              )}

              <div
                style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, boxShadow: "0 4px 20px rgba(107,143,212,0.08)", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
                className={`ws-writing-surface ${kartState.boldText ? "kart-banana-hit" : ""}${kartState.blurCounter ? " kart-blur-counter" : ""}`}
              >
                {/* nothing before the editor now */}
                <div
                  ref={textareaRef}
                  contentEditable={!readMode && (isRunning || isWaiting || isCountdown)}
                  suppressContentEditableWarning
                  onFocus={handleEditorFocus}
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
                  role="textbox"
                  aria-label="Your writing"
                  aria-multiline="true"
                  aria-readonly={readMode || (!isRunning && !isWaiting && !isCountdown)}
                  spellCheck={true}
                  data-placeholder={
                    isRunning
                      ? "Write here — the clock is ticking!"
                      : "Warm up here while you wait for the sprint to start…"
                  }
                  data-has-content={text.trim().length > 0 ? "true" : undefined}
                  className={`writing-editor w-full focus:outline-none text-foreground${
                    readMode ? " cursor-default select-text" : (!isRunning && !isWaiting && !isCountdown) ? " opacity-60 cursor-not-allowed" : ""
                  }`}
                  style={{
                    padding: "20px 24px",
                    background: "transparent",
                    border: "none",
                    flex: 1,
                    overflowY: "auto",
                    minHeight: 0,
                    fontFamily: writingStyle.fontFamily,
                    fontSize: `${writingStyle.fontSize}px`,
                    lineHeight: readMode ? 1.9 : writingStyle.lineHeight,
                    outline: "none",
                    caretColor: readMode ? "transparent" : undefined,
                    color: "#1a1a2e",
                  }}
                />
                {/* Below-textarea badge row */}
                <div className="flex items-center justify-end gap-2 pt-1.5 px-1">
                  <div
                    className="bg-primary/10 border border-primary/30 px-2 py-1 rounded text-[10px] font-semibold text-primary transition-opacity duration-500"
                    style={{ opacity: capsuleFlash ? 1 : 0 }}
                  >
                    Capsule saved
                  </div>
                </div>
              </div>
              {/* Word count + auto-save — outside the writing card, bottom-right */}
              {!distractionFree && (
                <div className="flex items-center justify-end gap-2 px-1 pt-1.5">
                  {saveStatus !== "unsaved" && (
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all duration-500 ${
                        saveStatus === "cloud"
                          ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                          : "bg-muted border text-muted-foreground"
                      }`}
                      title={isDemoSession() ? "Demo writing is saved on this device" : saveStatus === "cloud" ? "Saved on this device and backed up to the server" : "Saved on this device"}
                    >
                      {saveStatus === "cloud" ? (
                        <><span>✓</span><span>{isDemoSession() ? "Demo saved" : "Device + Cloud"}</span></>
                      ) : (
                        <><span>✓</span><span>Device</span></>
                      )}
                    </div>
                  )}
                  <div className={`kart-word-count bg-muted/60 border px-3 py-1 rounded-md flex items-baseline gap-1.5${kartState.blurCounter ? " kart-counter-obscured" : ""}`}>
                    <span className="font-mono font-semibold text-sm text-foreground">
                      {wordCount}
                      {room.mode === "kart" && kartState.bonusWords > 0 ? <span className="text-orange-400 text-xs ml-1">+{kartState.bonusWords}</span> : null}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">words</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — hidden in distraction-free mode */}
            {!distractionFree && <div className="flex flex-col gap-3 ws-room-sidebar" style={{ width: 240, minWidth: 240, alignSelf: "start" }}>
              {/* Pot indicator — shows total Spirit Coins bet on this sprint */}
              {(betSummary?.totalPot ?? 0) > 0 && (
                <div
                  title={
                    betSummary?.myBet
                      ? `${betSummary.bettorCount} bettor${betSummary.bettorCount === 1 ? "" : "s"} · your stake: ${betSummary.myBet}`
                      : `${betSummary?.bettorCount ?? 0} bettor${(betSummary?.bettorCount ?? 0) === 1 ? "" : "s"}`
                  }
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(245,197,66,0.16), rgba(232,147,58,0.12))",
                    border: "1px solid rgba(232,147,58,0.35)",
                    fontWeight: 700, color: "#92400e", fontSize: "0.9rem",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <Coins size={16} style={{ color: "#e8933a" }} />
                  Pot: {betSummary?.totalPot.toLocaleString()}
                  <span style={{ fontWeight: 500, opacity: 0.75, fontSize: "0.78rem" }}>
                    · {betSummary?.bettorCount ?? 0} in
                  </span>
                  {(isWaiting || isCountdown) && betSummary?.myBet == null && userId && (
                    <button
                      type="button"
                      onClick={() => setShowBetModal(true)}
                      style={{ marginLeft: 4, background: "rgba(255,255,255,0.5)", border: "1px solid rgba(232,147,58,0.4)", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#92400e" }}
                    >
                      Join
                    </button>
                  )}
                </div>
              )}

              <WritingArchive
                text={text}
                capsules={capsules}
                triggerLabel="My Writing"
                triggerVariant="outline"
                triggerClassName="w-full"
                triggerStyle={{ background: "var(--color-card)", border: "1.5px solid var(--color-border)", borderRadius: 12, padding: "13px 16px", fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", fontWeight: 600, color: "var(--color-foreground)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", cursor: "pointer", transition: "all 0.18s" }}
              />

              {/* Save to Folio */}
              <div style={{ display: "flex", gap: 0 }}>
                <button
                  onClick={saveToMyFiles}
                  style={{
                    flex: 1,
                    padding: "13px 14px",
                    borderRadius: folioTarget ? "12px 0 0 12px" : 12,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.18s",
                    background: "var(--color-card)",
                    border: "1.5px solid var(--color-border)",
                    borderRight: folioTarget ? "none" : "1.5px solid var(--color-border)",
                    color: savedToMyFiles ? "#16a34a" : "var(--color-foreground)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6B8FD4"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(107,143,212,0.15)"; }}
                  title={folioTarget ? `Save to ${folioTargetLabel || "the chosen Folio chapter"}` : "Save to Folio"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {folioTarget ? (savedToMyFiles ? "Saved ✓" : "Save to Folio") : "Save to Folio"}
                  </span>
                </button>
                {folioTarget && (
                  <button
                    onClick={changeFolioTarget}
                    style={{
                      padding: "13px 10px", borderRadius: "0 12px 12px 0",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center",
                      transition: "all 0.18s",
                      background: "var(--color-card)", border: "1.5px solid var(--color-border)", color: "var(--color-muted-foreground)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6B8FD4"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(107,143,212,0.15)"; }}
                    title="Change save destination"
                    aria-label="Change Folio save destination"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )}
              </div>

              {/* Chapter Finished — downloads chapter, clears box, keeps car position */}
              <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(107,143,212,0.08)" }}>
                <Button
                  className="w-full"
                  onClick={handleChapterFinished}
                  disabled={!text.trim() || (!isRunning && !isWaiting && !isCountdown)}
                  style={{ background: "linear-gradient(135deg, #7fa4e0, #5a82d0)", border: "none", borderRadius: "16px 16px 0 0", padding: "14px 16px", fontSize: "0.9rem", fontWeight: 700, color: "white", boxShadow: "0 4px 16px rgba(90,130,208,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <BookCheck className="w-4 h-4" />
                  Chapter Finished
                </Button>
                <p style={{ fontSize: "0.72rem", color: "#7a7a92", padding: "8px 16px", textAlign: "center", lineHeight: 1.4, borderBottom: "1px solid rgba(107,143,212,0.15)" }}>
                  Downloads chapter &amp; clears box — word count stays on the car
                </p>
                <button
                  onClick={downloadWriting}
                  disabled={!text}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: 12, width: "100%", fontSize: "0.82rem", color: "#7a7a92", background: "none", border: "none", cursor: text ? "pointer" : "not-allowed", opacity: text ? 1 : 0.5, transition: "color 0.18s" }}
                  onMouseEnter={e => { if (text) (e.currentTarget as HTMLElement).style.color = "#1a1a2e"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#7a7a92"; }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .txt
                </button>
              </div>

              {/* Live writers panel — shown in open (Spectator) mode, for
                  editors (so they can read what writers are doing), AND
                  whenever any other participant is an editor (so writers can
                  see the editor's notes/edits in real time). */}
              {(isOpenMode || isEditor || otherParticipants.some((p) => p.role === "editor")) && otherParticipants.length > 0 && (
                <div
                  className="transition-opacity duration-500"
                  style={{ opacity: isTyping && isRunning ? 0.3 : 1 }}
                  onMouseEnter={() => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); setIsTyping(false); }}
                >
                  <div style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: 12, boxShadow: "0 4px 20px rgba(107,143,212,0.08)" }}>
                    <SpectatorView
                      participants={otherParticipants}
                      participantTexts={participantTexts}
                      currentParticipantId={participantId}
                    />
                  </div>
                </div>
              )}

              {isWaiting && isCreator && (() => {
                const gladiatorNeedsOpponent = room.mode === "gladiator" &&
                  room.participants.length < 2;
                return (
                  <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(107,143,212,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7a7a92", letterSpacing: "0.06em", textTransform: "uppercase" }}>Host Controls</p>
                    {gladiatorNeedsOpponent && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium animate-pulse">
                        ⚔️ Waiting for a second gladiator to enter the arena…
                      </p>
                    )}
                    <Button
                      onClick={startSprint}
                      className="w-full"
                      disabled={!isConnected || gladiatorNeedsOpponent}
                      style={{ background: "linear-gradient(135deg, #7fa4e0, #5a82d0)", border: "none", borderRadius: 12, padding: 14, fontSize: "0.95rem", fontWeight: 700, color: "white", boxShadow: "0 6px 20px rgba(90,130,208,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <Play className="w-4 h-4" />
                      {room.countdownDelayMinutes > 0 ? `Start ${room.countdownDelayMinutes}m Timer` : "Start Sprint"}
                    </Button>
                  </div>
                );
              })()}

              {isCountdown && isCreator && (
                <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(107,143,212,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7a7a92", letterSpacing: "0.06em", textTransform: "uppercase" }}>Host Controls</p>
                  <Button onClick={startSprint} variant="outline" className="w-full" disabled style={{ borderRadius: 12, opacity: 0.7 }}>
                    <Play className="w-4 h-4 mr-2" />
                    Countdown running…
                  </Button>
                </div>
              )}

              {isCountdown && !isCreator && (
                <div style={{ background: "linear-gradient(135deg, rgba(232,168,56,0.1), rgba(232,168,56,0.06))", border: "1px solid rgba(232,168,56,0.2)", borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: "0.88rem", color: "#a07020", fontWeight: 600 }}>
                    Sprint starts in {formatCountdown(room.countdownTimeLeft ?? 0)} — get ready!
                  </p>
                </div>
              )}

              {isWaiting && !isCreator && (
                <div style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(107,143,212,0.08)", textAlign: "center" }}>
                  <p className="text-sm text-muted-foreground">
                    Waiting for the host to start the sprint…
                  </p>
                </div>
              )}

              {isRunning && isCreator && (
                <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(107,143,212,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7a7a92", letterSpacing: "0.06em", textTransform: "uppercase" }}>Host Controls</p>
                  <Button onClick={() => {
                      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
                      sendTextUpdate(currentTextRef.current, Math.max(0, wordCount - baselineWordCountRef.current));
                      flushAutoSave(true);
                      endSprint();
                    }} variant="destructive" className="w-full" disabled={!isConnected} style={{ borderRadius: 12 }}>
                    End Early
                  </Button>
                </div>
              )}

              {/* Focus mode is available during warmup and the sprint. */}
              {(isRunning || isWaiting || isCountdown) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDistractionFree(true)}
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Focus Mode
                </Button>
              )}

              {/* Notes — draggable sticky pad, available to every writer in any
                  mode/phase. Per-room key so each room has its own note. */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStickyOpen((v) => !v)}
              >
                <NotebookPen className="w-4 h-4 mr-2" />
                {stickyOpen ? "Hide Notes" : "Notes"}
              </Button>

              {/* Folio embed: save current text back to the chapter */}
              {isFolioEmbed && (
                <Button
                  className="w-full"
                  style={{ borderRadius: 12, background: "var(--color-foreground)", color: "var(--color-background)" }}
                  onClick={() => {
                    const text = textareaRef.current ? (textareaRef.current.innerText ?? "") : "";
                    window.parent.postMessage({ type: "folio:save", content: text }, window.location.origin);
                  }}
                >
                  Save to Folio chapter
                </Button>
              )}

              {/* Kart Mode HUD — right below Focus Mode button */}
              {room.mode === "kart" && isRunning && (
                <div className="rounded-xl border px-4 py-3" style={{ background: "rgba(20,20,30,0.85)", borderColor: "rgba(255,255,255,0.12)" }}>
                  <KartHUD
                    items={kartState.items}
                    kartBonusWords={kartState.bonusWords}
                    blurCounter={kartState.blurCounter}
                    boldText={kartState.boldText}
                    starActive={kartState.starActive}
                    onUseItem={sendUseItem}
                    flashEvent={kartState.flashEvent}
                    hitNotification={kartState.hitNotification}
                  />
                </div>
              )}
            </div>}

          </div>
        </div>
      )}


      {/* ── Goal hit dialog ─────────────────────────────────────────── */}
      <AlertDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Goal reached!</AlertDialogTitle>
            <AlertDialogDescription>
              You've hit your target of{" "}
              <strong>{room?.wordGoal?.toLocaleString()} words</strong>.
              Wish to keep writing until the timer runs out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setGoalDialogOpen(false);
                downloadWriting();
              }}
            >
              No, I'm done
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => setGoalDialogOpen(false)}>
              Yes, keep writing!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Folio save destination picker ────────────────────────────── */}
      <FolioSaveDialog
        open={folioSaveOpen}
        onClose={() => setFolioSaveOpen(false)}
        onSaved={handleFolioSaved}
        text={getCurrentPlainText()}
        initialTarget={folioTarget}
      />

      {/* ── Leave sprint confirmation ────────────────────────────────── */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              The sprint will keep going without you. Your writing so far has been auto-saved and won't be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setLocation("/")}
            >
              Leave Sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reaper Headstart Picker ── */}
      {showReaperModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 18,
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            padding: "28px 28px 22px",
            width: 340,
            maxWidth: "calc(100vw - 32px)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>💀</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary, #111)" }}>
                Reaper Mode
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #6b7280)", marginBottom: 20, lineHeight: 1.5 }}>
              Choose your headstart. The reaper won't move until this time has passed.
            </p>

            {/* Option grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 22 }}>
              {[3, 5, 10, 15, 20, 30, 45, 60].map((secs) => (
                <button
                  key={secs}
                  onClick={() => {
                    setReaperHeadstart(secs);
                    sessionStorage.setItem(`reaper-headstart-${code}`, String(secs));
                  }}
                  style={{
                    padding: "10px 0",
                    borderRadius: 10,
                    border: `2px solid ${reaperHeadstart === secs ? "#ef4444" : "var(--border, #e5e7eb)"}`,
                    background: reaperHeadstart === secs ? "#fef2f2" : "var(--surface-secondary, #f9fafb)",
                    color: reaperHeadstart === secs ? "#ef4444" : "var(--text-primary, #111)",
                    fontWeight: reaperHeadstart === secs ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "border-color .12s, background .12s",
                  }}
                >
                  {secs}s
                </button>
              ))}
            </div>

            {/* Selected summary */}
            <p style={{ fontSize: 12, color: "var(--text-secondary, #6b7280)", textAlign: "center", marginBottom: 18 }}>
              {reaperHeadstart === 3
                ? "Default — 3 seconds to get going."
                : `The reaper waits ${reaperHeadstart} seconds before chasing you.`}
            </p>

            <button
              onClick={() => setShowReaperModal(false)}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10,
                background: "#ef4444", color: "#fff",
                border: "none", fontWeight: 700, fontSize: 14,
                cursor: "pointer", letterSpacing: 0.2,
              }}
            >
              Let's go
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
