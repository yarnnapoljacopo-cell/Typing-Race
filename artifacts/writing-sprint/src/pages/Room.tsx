import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useSprintRoom } from "@/hooks/useSprintRoom";
import { RaceTrack } from "@/components/RaceTrack";
import { Timer } from "@/components/Timer";
import { ResultsScreen } from "@/components/ResultsScreen";
import { WritingToolbar, type WritingStyle } from "@/components/WritingToolbar";
import { WritingArchive, type Capsule } from "@/components/WritingArchive";
import { SpectatorView } from "@/components/SpectatorView";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle, Loader2, Play, WifiOff, Eye, Download, BookCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export default function Room() {
  const [, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";

  const [text, setText] = useState(() => {
    if (code) {
      try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; }
    }
    return "";
  });
  const [wordCount, setWordCount] = useState(() =>
    countWords((() => { try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; } })())
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [capsuleFlash, setCapsuleFlash] = useState(false);
  const [slowBitchVisible, setSlowBitchVisible] = useState(false);
  const [capsules, setCapsules] = useState<Capsule[]>(() => loadCapsules(code));
  const [writingStyle, setWritingStyle] = useState<WritingStyle>({
    fontFamily: "Georgia, serif",
    fontSize: 18,
    lineHeight: 1.75,
    paragraphMode: "none",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const serverSaveTimeoutRef = useRef<number | null>(null);
  const savedFlashTimeoutRef = useRef<number | null>(null);
  const capsuleFlashTimeoutRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const lastCapsuleThresholdRef = useRef<number>(
    capsules.filter((c) => !c.isFinal).reduce((max, c) => Math.max(max, c.wordCount), 0)
  );
  const currentTextRef = useRef<string>(text);
  const currentCapsulesRef = useRef<Capsule[]>(capsules);
  const finalSnapshotTakenRef = useRef<boolean>(false);
  const serverRestoreDoneRef = useRef<boolean>(false);

  // ── Baseline: words written BEFORE sprint started don't count ──────────
  // Set to the wordCount at the moment the sprint transitions to "running".
  const baselineWordCountRef = useRef<number>(0);
  const prevStatusRef = useRef<string | null>(null);

  // ── "Slow Bitch." — fired every 10 min if behind the leader ────────────
  const netWordCountRef = useRef<number>(0);
  const slowBitchHideTimerRef = useRef<number | null>(null);

  const flushAutoSave = useCallback((immediate = false) => {
    if (!code) return;
    const t = currentTextRef.current;
    const write = () => {
      try {
        if (t) localStorage.setItem(autoSaveKey(code), t);
        else localStorage.removeItem(autoSaveKey(code));
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
    }).catch(() => { /* silent — localStorage is the local fallback */ });
  }, [code, name]);

  const scheduleServerSave = useCallback((textToSave: string, wc: number) => {
    if (serverSaveTimeoutRef.current) clearTimeout(serverSaveTimeoutRef.current);
    serverSaveTimeoutRef.current = window.setTimeout(() => serverSaveNow(textToSave, wc), 10_000);
  }, [serverSaveNow]);

  const chapterCountRef = useRef<number>(1);

  const downloadWriting = useCallback(() => {
    const blob = new Blob([currentTextRef.current], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `writing-sprint-${code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  const {
    room,
    participantId,
    isConnected,
    error,
    participantTexts,
    restoredWordCount,
    setLatestText,
    sendTextUpdate,
    updateLocalWordCount,
    startSprint,
    restartSprint,
    endSprint,
  } = useSprintRoom({ code, name, isCreator: isCreatorParams });

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

  // Restore cursor after a programmatic paragraph insert
  useEffect(() => {
    if (pendingCursorRef.current !== null && textareaRef.current) {
      const pos = pendingCursorRef.current;
      textareaRef.current.selectionStart = pos;
      textareaRef.current.selectionEnd = pos;
      pendingCursorRef.current = null;
    }
  });

  useEffect(() => { currentTextRef.current = text; }, [text]);
  useEffect(() => { currentCapsulesRef.current = capsules; }, [capsules]);

  // ── Capture baseline when sprint starts ───────────────────────────────
  useEffect(() => {
    if (!room) return;
    if (prevStatusRef.current !== "running" && room.status === "running") {
      // Snapshot current word count as baseline (pre-written words don't count)
      baselineWordCountRef.current = countWords(currentTextRef.current);
      // Immediately send net 0 to server (existing text is pre-sprint)
      sendTextUpdate(currentTextRef.current, 0);
    }
    prevStatusRef.current = room.status;
  }, [room?.status, sendTextUpdate]);

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

  // ── Final capsule on sprint end ───────────────────────────────────────
  useEffect(() => {
    if (room?.status !== "finished" || !code) return;
    if (finalSnapshotTakenRef.current) return;
    finalSnapshotTakenRef.current = true;
    flushAutoSave();
    const finalText = currentTextRef.current;
    const finalWords = countWords(finalText);
    // Flush to server immediately on sprint end
    serverSaveNow(finalText, finalWords);
    if (!finalText) return;
    setCapsules((prev) => {
      const filtered = prev.filter((c) => !c.isFinal);
      const next: Capsule[] = [...filtered, { wordCount: finalWords, savedAt: Date.now(), text: finalText, isFinal: true }];
      scheduleIdle(() => saveCapsules(code, next));
      return next;
    });
  }, [room?.status, code, flushAutoSave, serverSaveNow]);


  // ── Core text update ──────────────────────────────────────────────────

  const applyText = useCallback((newText: string) => {
    const wc = countWords(newText);
    currentTextRef.current = newText;
    setText(newText);
    setWordCount(wc);

    // Net words = words typed SINCE sprint started (baseline subtracted)
    const netWc = Math.max(0, wc - baselineWordCountRef.current);
    setLatestText(newText, netWc);

    // Optimistic car movement uses net count
    if (participantId) updateLocalWordCount(participantId, netWc);

    // ── Time Capsule: snapshot every CAPSULE_INTERVAL words ──────────────
    const nextThreshold = lastCapsuleThresholdRef.current + CAPSULE_INTERVAL;
    if (wc >= nextThreshold) {
      const crossedThreshold = Math.floor(wc / CAPSULE_INTERVAL) * CAPSULE_INTERVAL;
      lastCapsuleThresholdRef.current = crossedThreshold;
      const newCapsule: Capsule = { wordCount: crossedThreshold, savedAt: Date.now(), text: newText };
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
    debounceTimeoutRef.current = window.setTimeout(() => sendTextUpdate(newText, netWc), 100);

    // 400ms debounced autosave to localStorage
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      flushAutoSave();
      setSavedFlash(true);
      if (savedFlashTimeoutRef.current) clearTimeout(savedFlashTimeoutRef.current);
      savedFlashTimeoutRef.current = window.setTimeout(() => setSavedFlash(false), 1500);
    }, 400);

    // 10s debounced server backup
    scheduleServerSave(newText, netWc);
  }, [code, participantId, setLatestText, sendTextUpdate, updateLocalWordCount, flushAutoSave, scheduleServerSave]);

  // ── Chapter Finished ───────────────────────────────────────────────────
  const handleChapterFinished = useCallback(() => {
    const chapterText = currentTextRef.current;
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

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyText(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (writingStyle.paragraphMode === "none") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insertion = writingStyle.paragraphMode === "indent" ? "\n    " : "\n\n";
    const newText = text.substring(0, start) + insertion + text.substring(end);
    pendingCursorRef.current = start + insertion.length;
    applyText(newText);
  };

  const handleStyleChange = (partial: Partial<WritingStyle>) => {
    setWritingStyle((prev) => ({ ...prev, ...partial }));
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Room code copied to clipboard." });
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (error) {
    const isFinishedError = error.toLowerCase().includes("finished");
    const isRoomGone = error === "Room not found";
    const canRejoin = !isFinishedError && !isRoomGone && code && name;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isFinishedError ? "Sprint Ended" : isRoomGone ? "Room No Longer Available" : "Connection Error"}
          </AlertTitle>
          <AlertDescription className="space-y-4 mt-2">
            <p>
              {isFinishedError
                ? "This sprint has already finished. Your writing is safely saved."
                : isRoomGone
                ? "This room has expired or been closed. Rooms only last while the session is active — once everyone leaves or the server restarts, the room is gone. Your writing was saved and you can download it from home."
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

  const isCreator = room.participants.find((p) => p.id === participantId)?.isCreator || isCreatorParams;
  const isRunning = room.status === "running";
  const isWaiting = room.status === "waiting";
  const isCountdown = room.status === "countdown";
  const isFinished = room.status === "finished";
  const isOpenMode = room.mode === "open";

  // Net word count: what shows on the badge and car during a sprint
  const netWordCount = isRunning ? Math.max(0, wordCount - baselineWordCountRef.current) : wordCount;
  // Keep ref in sync so the 10-min interval can read it without a stale closure
  netWordCountRef.current = netWordCount;

  // ── "Slow Bitch." every 10 min when behind the leader ──────────────────
  useEffect(() => {
    if (room?.status !== "running") return;

    const intervalId = window.setInterval(() => {
      const participants = room.participants;
      if (participants.length < 2) return; // no race if alone
      const leaderWc = Math.max(...participants.map((p) => p.wordCount));
      if (netWordCountRef.current >= leaderWc) return; // you ARE the leader
      // Show for 1.5 s then fade out
      setSlowBitchVisible(true);
      if (slowBitchHideTimerRef.current) clearTimeout(slowBitchHideTimerRef.current);
      slowBitchHideTimerRef.current = window.setTimeout(() => setSlowBitchVisible(false), 1500);
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      if (slowBitchHideTimerRef.current) clearTimeout(slowBitchHideTimerRef.current);
    };
  }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="min-h-screen w-full max-w-5xl mx-auto flex flex-col p-4 md:p-6 gap-4">

      {/* Reconnecting banner */}
      {!isConnected && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2 text-sm font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Connection lost — reconnecting… your writing is safe.</span>
          <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto shrink-0" />
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
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
        </div>
      </header>

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
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          <RaceTrack
            participants={room.participants}
            currentParticipantId={participantId}
            durationMinutes={room.durationMinutes}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">

            {/* Writing area */}
            <div className="md:col-span-3 flex flex-col">
              <WritingToolbar style={writingStyle} onChange={handleStyleChange} />
              <div className="flex flex-col flex-1 min-h-[380px]">
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
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  disabled={!isConnected || (!isRunning && !isWaiting && !isCountdown)}
                  placeholder={
                    !isConnected
                      ? "Reconnecting…"
                      : isRunning
                      ? "Write here — the clock is ticking!"
                      : "Warm up here while you wait for the sprint to start…"
                  }
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 w-full resize-none bg-card border shadow-sm p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    borderTop: (isWaiting || isCountdown) ? "none" : undefined,
                    borderRadius: (isWaiting || isCountdown) ? "0 0 0.5rem 0.5rem" : undefined,
                    fontFamily: writingStyle.fontFamily,
                    fontSize: `${writingStyle.fontSize}px`,
                    lineHeight: writingStyle.lineHeight,
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
                  <div
                    className="bg-muted border px-2 py-1 rounded text-[10px] font-medium text-muted-foreground transition-opacity duration-500"
                    style={{ opacity: savedFlash ? 1 : 0 }}
                  >
                    Saved
                  </div>
                  <div className="bg-muted/60 border px-3 py-1 rounded-md flex items-baseline gap-1.5">
                    <span className="font-mono font-semibold text-sm text-foreground">{netWordCount}</span>
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

            {/* Sidebar */}
            <div className="md:col-span-1 flex flex-col gap-4">
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

              {isWaiting && isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Host Controls</h3>
                  <Button onClick={startSprint} size="lg" className="w-full" disabled={!isConnected}>
                    <Play className="w-4 h-4 mr-2" />
                    {room.countdownDelayMinutes > 0 ? `Start ${room.countdownDelayMinutes}m Timer` : "Start Sprint"}
                  </Button>
                </div>
              )}

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
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
