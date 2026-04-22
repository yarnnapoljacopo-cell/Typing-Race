import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useSprintRoom, type RoomState } from "@/hooks/useSprintRoom";
import { RaceTrack } from "@/components/RaceTrack";
import { KartHUD } from "@/components/KartHUD";
import { GladiatorHUD } from "@/components/GladiatorHUD";
import { GladiatorResults } from "@/components/GladiatorResults";
import { BossTrack } from "@/components/BossTrack";
import { Timer } from "@/components/Timer";
import { ResultsScreen } from "@/components/ResultsScreen";
import { GameOverScreen } from "@/components/GameOverScreen";
import { WritingToolbar, type WritingStyle, type FormatType } from "@/components/WritingToolbar";
import { WritingArchive, type Capsule } from "@/components/WritingArchive";
import { SpectatorView } from "@/components/SpectatorView";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle, Loader2, Play, WifiOff, Eye, Download, BookCheck, BookOpen, PenLine, Maximize2, Minimize2, LogOut } from "lucide-react";
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

const CAPSULE_INTERVAL = 200;

// ── Helpers ────────────────────────────────────────────────────────────────

function useSearchParams() {
  return useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
}

// O(n) with zero array allocation — much faster than /\b\w+\b/g on large texts
function countWords(str: string): number {
  let count = 0;
  let inWord = false;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    // \w = [a-zA-Z0-9_]
    const isWordChar =
      (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
      (c >= 48 && c <= 57) || c === 95;
    if (isWordChar && !inWord) { count++; inWord = true; }
    else if (!isWordChar) { inWord = false; }
  }
  return count;
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
  return `sprint-autosave-${code}`;
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
  return `sprint-capsules-${code}`;
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

// ── Component ──────────────────────────────────────────────────────────────

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Room() {
  const [, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isSignedIn, userId } = useAuth();

  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";

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
    countWords((() => { try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; } })())
  );
  // Persistent save-status pill: never disappears, only upgrades.
  // "unsaved" → "local" (400 ms debounce) → "cloud" (5 s debounce).
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "local" | "cloud">(() =>
    // If we loaded text from localStorage, start in "local" state
    code && localStorage.getItem(autoSaveKey(code)) ? "local" : "unsaved"
  );
  const [capsuleFlash, setCapsuleFlash] = useState(false);
  const [slowBitchVisible, setSlowBitchVisible] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [capsules, setCapsules] = useState<Capsule[]>(() => loadCapsules(code));
  const [writingStyle, setWritingStyle] = useState<WritingStyle>(loadWritingStyle);
  const [savedToMyFiles, setSavedToMyFiles] = useState(false);
  const [distractionFree, setDistractionFree] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState<number | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [survivedSeconds, setSurvivedSeconds] = useState(0);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
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
  const hasAutoDownloadedRef = useRef<boolean>(false);
  // Stores the net word count restored by the server on reconnect so the
  // baseline effect can set the correct offset instead of resetting to 0.
  const restoredNetWordsRef = useRef(0);

  // ── Baseline: words written BEFORE sprint started don't count ──────────
  // Set to the wordCount at the moment the sprint transitions to "running".
  const baselineWordCountRef = useRef<number>(0);
  const prevStatusRef = useRef<string | null>(null);

  // ── "Slow Bitch." — fired every 5 min if behind the leader ─────────────
  const netWordCountRef = useRef<number>(0);
  const slowBitchHideTimerRef = useRef<number | null>(null);
  // Always-current snapshot of room so the interval doesn't read stale state
  const roomRef = useRef<RoomState | null>(null);

  // ── Goal mode tracking ───────────────────────────────────────────────────
  const wordGoalRef = useRef<number | null>(null);
  const goalHitShownRef = useRef<boolean>(false);

  const flushAutoSave = useCallback((immediate = false) => {
    if (!code) return;
    const t = currentTextRef.current;
    const write = () => {
      try {
        if (t) localStorage.setItem(autoSaveKey(code), t);
        else localStorage.removeItem(autoSaveKey(code));
        // Upgrade status to at least "local" — never downgrade from "cloud"
        setSaveStatus((prev) => prev === "cloud" ? "cloud" : "local");
      } catch { /* storage unavailable */ }
    };
    // During normal typing pauses: defer so it never blocks the main thread.
    // During page unload: write immediately (idle callback may never fire).
    if (immediate) write();
    else scheduleIdle(write);
  }, [code]);

  // ── Server backup helpers ───────────────────────────────────────────────
  const serverSaveNow = useCallback((textToSave: string, wc: number) => {
    if (!code || !name) return;
    fetch(`/api/rooms/${encodeURIComponent(code)}/writing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantName: name, text: textToSave, wordCount: wc }),
    })
      .then((r) => { if (r.ok) setSaveStatus("cloud"); })
      .catch(() => { /* silent — localStorage is the local fallback */ });
  }, [code, name]);

  const scheduleServerSave = useCallback((textToSave: string, wc: number) => {
    if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
    // Reduced from 10 s to 5 s so the cloud copy is always close behind typing
    serverSaveTimeoutRef.current = window.setTimeout(() => serverSaveNow(textToSave, wc), 5_000);
  }, [serverSaveNow]);

  const chapterCountRef = useRef<number>(1);

  const saveToMyFiles = useCallback(async () => {
    const plainText = textareaRef.current ? (textareaRef.current.innerText ?? "") : currentTextRef.current;
    const wc = netWordCountRef.current;
    try {
      const res = await fetch(`/api/user/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomCode: code, participantName: name, text: plainText, wordCount: wc }),
      });
      if (res.ok) {
        setSavedToMyFiles(true);
        toast({ title: "Saved to My Files" });
      } else if (res.status === 401) {
        toast({ title: "Sign in to save to My Files", variant: "destructive" });
      } else {
        toast({ title: "Couldn't save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't save", variant: "destructive" });
    }
  }, [code, name, toast]);

  const downloadWriting = useCallback(() => {
    const plainText = textareaRef.current ? (textareaRef.current.innerText ?? "") : currentTextRef.current;
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
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const caret = range.getBoundingClientRect();

    // Degenerate rect (all zeros) means the browser hasn't laid out the cursor
    // yet — most common after Enter on a fresh empty line. Skip rather than
    // scrolling to the wrong place.
    if (!caret.top && !caret.left && !caret.bottom) return;

    const divRect = div.getBoundingClientRect();
    const lineH = writingStyle.fontSize * writingStyle.lineHeight;
    const caretOffsetTop = caret.top - divRect.top + div.scrollTop;
    div.scrollTop = Math.max(0, caretOffsetTop - div.clientHeight / 2 + lineH / 2);
  }, [writingStyle.fontSize, writingStyle.lineHeight]);

  const {
    room,
    participantId,
    isConnected,
    isReconnecting,
    error,
    participantTexts,
    restoredWordCount,
    setLatestText,
    sendTextUpdate,
    updateLocalWordCount,
    startSprint,
    restartSprint,
    endSprint,
    kartState,
    sendUseItem,
    gladiatorState,
  } = useSprintRoom({ code, name, isCreator: isCreatorParams, password: roomPassword, clerkUserId: userId ?? null });

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
  useEffect(() => {
    if (textareaInitDoneRef.current) return; // already ran
    const div = textareaRef.current;
    if (!div) return; // div not in DOM yet — will retry when participantId changes
    textareaInitDoneRef.current = true;
    if (!text) return;
    div.innerHTML = text;
    // Cursor to end
    const sel = window.getSelection();
    if (sel && div.lastChild) {
      const range = document.createRange();
      range.selectNodeContents(div);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  // text is intentionally omitted: we only want the stored value, not re-init on keystrokes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]); // participantId defined ⟹ room loaded ⟹ div now in DOM

  useEffect(() => { currentTextRef.current = text; }, [text]);
  useEffect(() => { currentCapsulesRef.current = capsules; }, [capsules]);

  // ── Capture baseline when sprint starts ───────────────────────────────
  useEffect(() => {
    if (!room) return;
    if (prevStatusRef.current !== "running" && room.status === "running") {
      // Play chime on genuine sprint start — skip on page-refresh reconnect (prevStatus===null)
      if (prevStatusRef.current !== null) playStartSound();

      const restored = restoredNetWordsRef.current;
      const currentTotalWords = countWords(currentTextRef.current);
      if (prevStatusRef.current === null && restored > 0) {
        // Page-refresh reconnect: server knows our net word count.
        // Set baseline so the display resumes from the correct value.
        // e.g. totalWords=500, restored=500 → baseline=0 → net=500 ✓
        //      totalWords=600, restored=500 → baseline=100 → net=500 ✓
        baselineWordCountRef.current = Math.max(0, currentTotalWords - restored);
        // Do NOT send net-0 — server already has the correct count.
      } else if (prevStatusRef.current === null && currentTotalWords > 0) {
        // Page-refresh reconnect: server lost our count (e.g. 5 s server-save
        // hadn't fired yet, or a prior refresh zeroed it via the else branch).
        // Keep baseline=0 so net = totalWords, and re-announce our count to
        // the server so the DB is corrected for future refreshes.
        baselineWordCountRef.current = 0;
        sendTextUpdate(currentTextRef.current, currentTotalWords);
      } else {
        // Genuine sprint start (or late join with no prior text).
        // Snapshot current words so any pre-sprint text doesn't count.
        baselineWordCountRef.current = currentTotalWords;
        sendTextUpdate(currentTextRef.current, 0);
      }
    }
    prevStatusRef.current = room.status;
  }, [room?.status, sendTextUpdate]);

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
    }, 150);
    return () => clearInterval(interval);
  // Re-run when status changes or game-over state changes (to avoid resetting
  // clientElapsedMs while the spectate panel is still active).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, isGameOver]);

  // ── Crash protection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const flushAll = () => {
      if (autoSaveTimeoutRef.current) { clearTimeout(autoSaveTimeoutRef.current); autoSaveTimeoutRef.current = null; }
      flushAutoSave(true); // immediate — page may close before idle callback fires
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
    };
  }, [code, flushAutoSave]);

  // ── Death Mode grace countdown ────────────────────────────────────────
  // Compute a safe "am I eliminated" value using optional chaining so it can
  // live before the early returns and be used as a real effect dependency.
  const _deathWpm = room?.deathModeWpm ?? null;
  const _myWC = room?.participants.find((p) => p.id === participantId)?.wordCount ?? 0;
  const _wordGoal = room?.wordGoal ?? null;
  const _durMin = room?.durationMinutes ?? 0;
  // Use smooth client-side elapsed time for reaper position
  const _reaperEarlyWC = _deathWpm != null && room?.status === "running"
    ? Math.floor(_deathWpm * (clientElapsedMs / 1000) / 60)
    : 0;
  const isEliminatedEarly = _reaperEarlyWC > 0 && _myWC < _reaperEarlyWC && _myWC < (_wordGoal ?? _durMin * 200);
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
    const finalPlain = textareaRef.current ? (textareaRef.current.innerText ?? "") : finalHtml;
    const finalWords = countWords(finalPlain);
    // Flush to server immediately on sprint end
    serverSaveNow(finalHtml, finalWords);
    if (!finalHtml) return;
    setCapsules((prev) => {
      const filtered = prev.filter((c) => !c.isFinal);
      const next: Capsule[] = [...filtered, { wordCount: finalWords, savedAt: Date.now(), text: finalHtml, isFinal: true }];
      scheduleIdle(() => saveCapsules(code, next));
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
      div.style.flex = "";
      div.style.paddingTop = "";
      div.style.paddingBottom = "";
      return;
    }
    // Capture current rendered height (min 380px from the Tailwind class)
    const h = Math.max(380, div.getBoundingClientRect().height);
    div.style.height = `${h}px`;
    div.style.flex = "none";
    const pad = Math.max(160, Math.floor(h * 0.45));
    div.style.paddingTop = `${pad}px`;
    div.style.paddingBottom = `${pad}px`;
    // Scroll so cursor is already centred when mode turns on
    setTimeout(scrollToCursor, 50);
  }, [writingStyle.typewriterMode, scrollToCursor]);

  // ── Core text update ──────────────────────────────────────────────────
  // When called with an html string, sets the editor content first (for
  // programmatic restores / clears). When called with no args, just reads
  // the current editor content and syncs all state (used from handleInput,
  // handleFormat, handleKeyDown after execCommand).

  const applyText = useCallback((newHtml?: string) => {
    const div = textareaRef.current;
    if (!div) return;

    if (newHtml !== undefined) {
      // Programmatic update — set innerHTML and move cursor to end
      div.innerHTML = newHtml;
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
    // textContent avoids a forced layout reflow (innerText triggers style/layout
    // recalc on every read, which is expensive on mobile CPUs).
    const plainText = div.textContent ?? "";
    const wc = countWords(plainText);
    currentTextRef.current = html;
    setText(html);
    setWordCount(wc);

    // Net words = words typed SINCE sprint started (baseline subtracted)
    const netWc = Math.max(0, wc - baselineWordCountRef.current);
    setLatestText(html, netWc);

    // Optimistic car movement — throttled to 200 ms so mobile doesn't
    // re-render Framer Motion on every keystroke.  The car's 0.6 s transition
    // makes the gap invisible.  PC users see no difference.
    pendingNetWcRef.current = netWc;
    if (!raceThrottleRef.current) {
      raceThrottleRef.current = window.setTimeout(() => {
        raceThrottleRef.current = null;
        if (participantId) updateLocalWordCount(participantId, pendingNetWcRef.current);
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
        scheduleIdle(() => saveCapsules(code, updated));
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
  }, [code, participantId, setLatestText, sendTextUpdate, updateLocalWordCount, flushAutoSave, scheduleServerSave]);

  // ── Chapter Finished ───────────────────────────────────────────────────
  const handleChapterFinished = useCallback(() => {
    const chapterText = textareaRef.current ? (textareaRef.current.innerText ?? "") : currentTextRef.current;
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
    const currentNetWc = Math.max(0, wordCount - baselineWordCountRef.current);
    baselineWordCountRef.current = -currentNetWc;

    // Clear the box — applyText updates car, localStorage, and debounced server sync
    applyText("");

    // Immediately tell the server: empty text but same word count, so a rejoin
    // won't restore the cleared chapter text from the backup
    serverSaveNow("", currentNetWc);

    chapterCountRef.current += 1;

    toast({
      title: `Chapter ${chapterNum} saved`,
      description: "Downloaded and cleared. Your sprint word count continues from here.",
    });
  }, [wordCount, code, applyText, serverSaveNow, toast]);

  // ── Restore from server if localStorage was empty ──────────────────────
  useEffect(() => {
    if (!code || !name || serverRestoreDoneRef.current) return;
    if (currentTextRef.current) { serverRestoreDoneRef.current = true; return; }
    serverRestoreDoneRef.current = true;
    fetch(`/api/rooms/${encodeURIComponent(code)}/writing/${encodeURIComponent(name)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.text && !currentTextRef.current) {
          applyText(data.text);
          try { localStorage.setItem(autoSaveKey(code), data.text); } catch { /* ignore */ }
          toast({ title: "Writing restored", description: "Your previous writing has been recovered from the server." });
        }
      })
      .catch(() => { /* silent */ });
  }, [code, name, applyText, toast]);

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

    fetch(`${basePath}/api/user/xp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wordCount: myWc, isFirstPlace, roomCode: code }),
    })
      .then((r) => r.json())
      .then((data: { xpGained?: number }) => {
        if (typeof data.xpGained === "number") setXpGained(data.xpGained);
      })
      .catch(() => { /* silent */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, isSignedIn, participantId]);

  // ── "Slow Bitch." every 5 min when behind the leader ───────────────────
  // Must live BEFORE the early returns (if !room / if error) so hook order
  // stays constant across every render.
  // Uses roomRef so the callback always reads the latest participants/word
  // counts rather than the stale closure captured at sprint-start.
  useEffect(() => {
    if (room?.status !== "running") return;
    const intervalId = window.setInterval(() => {
      const currentRoom = roomRef.current;
      if (!currentRoom) return;
      const participants = currentRoom.participants;
      if (participants.length < 2) return;
      const leaderWc = Math.max(...participants.map((p) => p.wordCount));
      if (leaderWc <= 0) return; // everyone still at 0 — too early
      if (netWordCountRef.current >= leaderWc) return;
      setSlowBitchVisible(true);
      if (slowBitchHideTimerRef.current) clearTimeout(slowBitchHideTimerRef.current);
      slowBitchHideTimerRef.current = window.setTimeout(() => setSlowBitchVisible(false), 2500);
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(intervalId);
      if (slowBitchHideTimerRef.current) clearTimeout(slowBitchHideTimerRef.current);
    };
  }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────

  // User typing in the contenteditable editor — just sync from current DOM state
  const handleInput = useCallback(() => {
    applyText();
    if (writingStyle.typewriterMode) requestAnimationFrame(scrollToCursor);
  }, [applyText, writingStyle.typewriterMode, scrollToCursor]);

  // Normalise Enter across browsers and apply paragraph mode
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (writingStyle.paragraphMode === "indent") {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertHTML", false, "<br>\u00a0\u00a0\u00a0\u00a0");
    } else if (writingStyle.paragraphMode === "double") {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertHTML", false, "<br><br>");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("insertHTML", false, "<br>");
    }
    applyText();
    // rAF so the new line is in the DOM before we compute the caret rect
    if (writingStyle.typewriterMode) requestAnimationFrame(scrollToCursor);
  }, [writingStyle.paragraphMode, writingStyle.typewriterMode, applyText, scrollToCursor]);

  // Strip pasted HTML — keep only the plain text
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const plain = e.clipboardData.getData("text/plain");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand("insertText", false, plain);
    applyText();
  }, [applyText]);

  const handleStyleChange = (partial: Partial<WritingStyle>) => {
    setWritingStyle((prev) => {
      const next = { ...prev, ...partial };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleFormat = useCallback((type: FormatType) => {
    const div = textareaRef.current;
    if (!div) return;
    div.focus();
    const command = type === "bold" ? "bold" : type === "italic" ? "italic" : "underline";
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false, undefined);
    applyText();
  }, [applyText]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Room code copied to clipboard." });
  };

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
                    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`);
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
      ? Math.floor(room.deathModeWpm * (clientElapsedMs / 1000) / 60)
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
  const netWordCount = isRunning ? Math.max(0, wordCount - baselineWordCountRef.current) : wordCount;

  // Death Mode: smooth client-side reaper position (updates every 150 ms)
  const reaperWordCount = isRunning && room.deathModeWpm != null
    ? Math.floor(room.deathModeWpm * (clientElapsedMs / 1000) / 60)
    : null;
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
    <div className={distractionFree
      ? "fixed inset-0 z-50 bg-background flex flex-col overflow-auto"
      : "min-h-screen w-full max-w-5xl mx-auto flex flex-col p-4 md:p-6 gap-4"
    }>

      {/* Gladiator execution / victory / draw overlay */}
      {room?.mode === "gladiator" && gladiatorState.executionResult && (
        <GladiatorResults result={gladiatorState.executionResult} participantId={participantId} />
      )}

      {/* Reconnecting banner */}
      {(!isConnected || isReconnecting) && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {isReconnecting
              ? "Server restarted — reconnecting… your room and writing are being restored."
              : "Connection lost — reconnecting… your writing is safe."}
          </span>
          <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto shrink-0" />
        </div>
      )}

      {/* Header — hidden in distraction-free mode */}
      {!distractionFree && <header className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-serif font-bold text-lg text-foreground">Writing Sprint</h1>
          {isOpenMode && (
            <span className="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
              <Eye className="w-3 h-3" /> Open
            </span>
          )}
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Room:</span>
            <code className="font-mono text-sm font-bold bg-muted px-2 py-0.5 rounded select-all">{code}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyRoomCode}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {room.participants.slice(0, 4).map((p) => (
              <div
                key={p.id}
                title={p.name}
                className="w-7 h-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary"
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {room.participants.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                +{room.participants.length - 4}
              </div>
            )}
          </div>
          <span className="text-sm text-muted-foreground ml-1">
            {room.participants.length} {room.participants.length === 1 ? "writer" : "writers"}
          </span>

          {/* Read / Write toggle — visible in all active states */}
          {(isWaiting || isCountdown || isRunning || isFinished) && (
            <>
              <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
              <Button
                variant={readMode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setReadMode((v) => {
                    if (v) {
                      // returning to write — refocus editor after paint
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
                className="gap-1.5 text-xs px-2"
                title={readMode ? "Switch back to writing" : "Read what you've written"}
              >
                {readMode ? (
                  <><PenLine className="w-3.5 h-3.5" /><span className="hidden sm:inline">Write</span></>
                ) : (
                  <><BookOpen className="w-3.5 h-3.5" /><span className="hidden sm:inline">Read</span></>
                )}
              </Button>
            </>
          )}

          {/* Leave — always visible in the top-right */}
          <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeaveDialogOpen(true)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs px-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>}

      {/* Main */}
      {isFinished ? (
        <div className="flex-1 flex items-center justify-center">
          <ResultsScreen
            participants={room.participants}
            currentParticipantId={participantId}
            isCreator={isCreator}
            onRestart={restartSprint}
            myText={text}
            capsules={capsules}
            xpGained={xpGained}
            isBossMode={room.mode === "boss"}
          />
        </div>
      ) : (
        <div className={distractionFree ? "flex-1 flex flex-col" : "flex-1 flex flex-col gap-4"}>
          {/* Race / boss track — hidden in distraction-free mode */}
          {!distractionFree && (
            <>
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
                  isKartMode={room.mode === "kart"}
                />
              )}
              {/* Death Mode: grace-period countdown banner */}
              {graceCountdown !== null && isRunning && (
                <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-red-500/70 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300 animate-in fade-in duration-200">
                  <span className="text-xl tabular-nums">{graceCountdown}</span>
                  <span>The reaper caught you — keep typing or you're out!</span>
                  <span className="text-xl">💀</span>
                </div>
              )}
            </>
          )}

          <div className={distractionFree
            ? "flex-1 flex flex-col px-6 md:px-24 py-4"
            : "grid grid-cols-1 md:grid-cols-4 gap-4 flex-1"
          }>

            {/* Writing area */}
            <div className={distractionFree ? "flex-1 flex flex-col max-w-3xl mx-auto w-full" : "md:col-span-3 flex flex-col"}>
              {/* Distraction-free minimal top bar */}
              {distractionFree && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                      {room.timeLeft != null
                        ? `${Math.floor(room.timeLeft / 60)}:${String(room.timeLeft % 60).padStart(2, "0")}`
                        : "--:--"}
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
              {/* Kart Mode HUD — shown in both normal and focus modes, below focus bar */}
              {room.mode === "kart" && isRunning && participantId && (
                <div className="mb-3 rounded-xl border px-4 py-3" style={{ background: "rgba(20,20,30,0.85)", borderColor: "rgba(255,255,255,0.12)" }}>
                  <KartHUD
                    items={kartState.items}
                    kartBonusWords={kartState.bonusWords}
                    blurCounter={kartState.blurCounter}
                    boldText={kartState.boldText}
                    starActive={kartState.starActive}
                    onUseItem={sendUseItem}
                    flashEvent={kartState.flashEvent}
                  />
                </div>
              )}
              {!readMode && <WritingToolbar style={writingStyle} onChange={handleStyleChange} onFormat={handleFormat} />}
              <div className={`flex flex-col flex-1 min-h-[380px]${kartState.boldText ? " kart-banana-hit" : ""}${kartState.blurCounter ? " kart-blur-counter" : ""}`}>
                {/* Pre-sprint / countdown hint bar */}
                {(isWaiting || isCountdown) && (
                  <div className={`flex items-center justify-center gap-2 border text-xs font-medium py-1.5 px-3 ${
                    isCountdown
                      ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300"
                      : "bg-primary/8 border-primary/20 text-primary"
                  }`}
                    style={{ borderBottom: "none" }}
                  >
                    {isCountdown ? (
                      <>
                        <span className="font-mono font-bold text-base tabular-nums">
                          {formatCountdown(room.countdownTimeLeft ?? 0)}
                        </span>
                        <span>until the sprint starts — warm up while you wait!</span>
                      </>
                    ) : (
                      <span>✍️ Write ahead while you wait — words written now <strong>won't count</strong> toward your score.</span>
                    )}
                  </div>
                )}
                <div
                  ref={textareaRef}
                  contentEditable={!readMode && (isRunning || isWaiting || isCountdown)}
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  spellCheck={false}
                  data-placeholder={
                    isRunning
                      ? "Write here — the clock is ticking!"
                      : "Warm up here while you wait for the sprint to start…"
                  }
                  className={`writing-editor flex-1 w-full border shadow-sm p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground overflow-auto min-h-[380px]${
                    readMode
                      ? " bg-card/60 cursor-default select-text"
                      : (!isRunning && !isWaiting && !isCountdown)
                      ? " bg-card opacity-60 cursor-not-allowed"
                      : " bg-card"
                  }`}
                  style={{
                    borderTop: (isWaiting || isCountdown) ? "none" : undefined,
                    borderRadius: (isWaiting || isCountdown) ? "0 0 0.5rem 0.5rem" : undefined,
                    fontFamily: writingStyle.fontFamily,
                    fontSize: `${writingStyle.fontSize}px`,
                    lineHeight: readMode ? 1.9 : writingStyle.lineHeight,
                    outline: readMode ? "none" : undefined,
                    caretColor: readMode ? "transparent" : undefined,
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
                  {/* Persistent save-status pill — always visible, never flashes away */}
                  {saveStatus !== "unsaved" && (
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-all duration-500 ${
                        saveStatus === "cloud"
                          ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400"
                          : "bg-muted border text-muted-foreground"
                      }`}
                      title={
                        saveStatus === "cloud"
                          ? "Saved on this device and backed up to the server"
                          : "Saved on this device — server backup in progress"
                      }
                    >
                      {saveStatus === "cloud" ? (
                        <><span>✓</span><span>Device + Cloud</span></>
                      ) : (
                        <><span>✓</span><span>Device</span></>
                      )}
                    </div>
                  )}
                  <button
                    onClick={saveToMyFiles}
                    title={savedToMyFiles ? "Saved to Files" : "Save to Files"}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-all duration-200 ${
                      savedToMyFiles
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                    }`}
                  >
                    {savedToMyFiles ? <BookCheck size={12} /> : <BookOpen size={12} />}
                    {savedToMyFiles ? "Saved" : "Save to Files"}
                  </button>
                  <div className="kart-word-count bg-muted/60 border px-3 py-1 rounded-md flex items-baseline gap-1.5">
                    <span className="font-mono font-semibold text-sm text-foreground">{netWordCount}{room.mode === "kart" && kartState.bonusWords > 0 ? <span className="text-orange-400 text-xs ml-1">+{kartState.bonusWords}</span> : null}</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {isRunning ? "words" : "warm-up"}
                    </span>
                  </div>
                </div>
                {/* Slow Bitch notification — below the badge row */}
                <div
                  className="flex justify-center pt-1 transition-opacity duration-300"
                  style={{ opacity: slowBitchVisible ? 1 : 0, pointerEvents: "none" }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 bg-foreground/90 text-background text-xs font-medium px-3 py-1 rounded-full select-none"
                  >
                    🐢 Slow Bitch.
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar — hidden in distraction-free mode */}
            {!distractionFree && <div className="md:col-span-1 flex flex-col gap-4">
              <Timer timeLeft={room.timeLeft} countdownTimeLeft={room.countdownTimeLeft} status={room.status} />

              <WritingArchive
                text={text}
                capsules={capsules}
                triggerLabel="My Writing"
                triggerVariant="outline"
                triggerClassName="w-full"
              />

              {/* Chapter Finished — downloads chapter, clears box, keeps car position */}
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleChapterFinished}
                  disabled={!text.trim() || (!isRunning && !isWaiting && !isCountdown)}
                >
                  <BookCheck className="w-4 h-4 mr-2" />
                  Chapter Finished
                </Button>
                <p className="text-[10px] text-muted-foreground text-center leading-snug px-1">
                  Downloads chapter &amp; clears box — word count stays on the car
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={downloadWriting}
                disabled={!text}
              >
                <Download className="w-4 h-4 mr-2" />
                Download .txt
              </Button>

              {/* Live writers panel — only in open mode */}
              {isOpenMode && otherParticipants.length > 0 && (
                <div className="bg-card border rounded-lg p-3 shadow-sm">
                  <SpectatorView
                    participants={otherParticipants}
                    participantTexts={participantTexts}
                    currentParticipantId={participantId}
                  />
                </div>
              )}

              {isWaiting && isCreator && (() => {
                const gladiatorNeedsOpponent = room.mode === "gladiator" &&
                  room.participants.length < 2;
                return (
                  <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Host Controls</h3>
                    {gladiatorNeedsOpponent && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 text-center font-medium animate-pulse">
                        ⚔️ Waiting for a second gladiator to enter the arena…
                      </p>
                    )}
                    <Button
                      onClick={startSprint}
                      size="lg"
                      className="w-full"
                      disabled={!isConnected || gladiatorNeedsOpponent}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {room.countdownDelayMinutes > 0 ? `Start ${room.countdownDelayMinutes}m Timer` : "Start Sprint"}
                    </Button>
                  </div>
                );
              })()}

              {isCountdown && isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Host Controls</h3>
                  <Button onClick={startSprint} size="lg" variant="outline" className="w-full" disabled>
                    <Play className="w-4 h-4 mr-2" />
                    Countdown running…
                  </Button>
                </div>
              )}

              {isCountdown && !isCreator && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 shadow-sm text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                    Sprint starts in {formatCountdown(room.countdownTimeLeft ?? 0)} — get ready!
                  </p>
                </div>
              )}

              {isWaiting && !isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm text-center">
                  <p className="text-sm text-muted-foreground">
                    Waiting for the host to start the sprint…
                  </p>
                </div>
              )}

              {isRunning && isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Host Controls</h3>
                  <Button onClick={endSprint} variant="destructive" className="w-full" disabled={!isConnected}>
                    End Early
                  </Button>
                </div>
              )}

              {/* Focus mode button — available once sprint is running */}
              {isRunning && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDistractionFree(true)}
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Focus Mode
                </Button>
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
    </div>
  );
}
