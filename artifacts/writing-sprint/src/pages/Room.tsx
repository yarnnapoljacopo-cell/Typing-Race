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
import { Copy, AlertCircle, Loader2, Play, WifiOff, Eye, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const CAPSULE_INTERVAL = 200;

// ── Helpers ────────────────────────────────────────────────────────────────

function useSearchParams() {
  return useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
}

function countWords(str: string): number {
  const matches = str.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
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

  const flushAutoSave = useCallback(() => {
    if (!code) return;
    const t = currentTextRef.current;
    try {
      if (t) localStorage.setItem(autoSaveKey(code), t);
      else localStorage.removeItem(autoSaveKey(code));
    } catch { /* storage unavailable */ }
  }, [code]);

  // ── Server backup helpers ───────────────────────────────────────────────
  const serverSaveNow = useCallback((textToSave: string, wc: number) => {
    if (!code || !name || !textToSave) return;
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
      flushAutoSave();
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
      saveCapsules(code, next);
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
        saveCapsules(code, updated);
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
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="space-y-4 mt-2">
            <p>{error}</p>
            <Button variant="outline" onClick={() => setLocation("/")} className="w-full">Return Home</Button>
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
  const isFinished = room.status === "finished";
  const isOpenMode = room.mode === "open";

  // Net word count: what shows on the badge and car during a sprint
  const netWordCount = isRunning ? Math.max(0, wordCount - baselineWordCountRef.current) : wordCount;

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
              <div className="relative flex-1 min-h-[380px]">
                {/* Pre-sprint hint bar */}
                {isWaiting && (
                  <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-center bg-primary/8 border border-primary/20 text-primary text-xs font-medium py-1.5 px-3 gap-1.5">
                    <span>✍️ Write ahead while you wait — words written now <strong>won't count</strong> toward your score.</span>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  disabled={!isConnected || (!isRunning && !isWaiting)}
                  placeholder={
                    !isConnected
                      ? "Reconnecting…"
                      : isRunning
                      ? "Write here — the clock is ticking!"
                      : "Warm up here while you wait for the sprint to start…"
                  }
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full h-full resize-none bg-card border rounded-b-lg shadow-sm p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    paddingTop: isWaiting ? "2.75rem" : undefined,
                    fontFamily: writingStyle.fontFamily,
                    fontSize: `${writingStyle.fontSize}px`,
                    lineHeight: writingStyle.lineHeight,
                    borderTop: "none",
                  }}
                />
                {/* Bottom-right badge row */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-none">
                  <div
                    className="bg-primary/10 backdrop-blur border border-primary/30 px-2 py-1 rounded text-[10px] font-semibold text-primary transition-opacity duration-500"
                    style={{ opacity: capsuleFlash ? 1 : 0 }}
                  >
                    Capsule saved
                  </div>
                  <div
                    className="bg-background/90 backdrop-blur border px-2 py-1 rounded text-[10px] font-medium text-muted-foreground transition-opacity duration-500"
                    style={{ opacity: savedFlash ? 1 : 0 }}
                  >
                    Saved
                  </div>
                  <div className="bg-background/90 backdrop-blur border px-3 py-1.5 rounded-md shadow-sm flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-lg">{netWordCount}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isRunning ? "words" : "warm-up"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="md:col-span-1 flex flex-col gap-4">
              <Timer timeLeft={room.timeLeft} status={room.status} />

              <WritingArchive
                text={text}
                capsules={capsules}
                triggerLabel="My Writing"
                triggerVariant="outline"
                triggerClassName="w-full"
              />

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
                    Start Sprint
                  </Button>
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
