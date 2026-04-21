import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useSprintRoom } from "@/hooks/useSprintRoom";
import { RaceTrack } from "@/components/RaceTrack";
import { Timer } from "@/components/Timer";
import { ResultsScreen } from "@/components/ResultsScreen";
import { WritingToolbar, type WritingStyle } from "@/components/WritingToolbar";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle, Loader2, Play, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

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

// ── Component ──────────────────────────────────────────────────────────────

export default function Room() {
  const [, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";

  const [text, setText] = useState(() => {
    // Restore any autosaved draft for this room on first render
    if (code) {
      try {
        return localStorage.getItem(autoSaveKey(code)) ?? "";
      } catch {
        return "";
      }
    }
    return "";
  });
  const [wordCount, setWordCount] = useState(() => countWords(
    (() => { try { return localStorage.getItem(autoSaveKey(code)) ?? ""; } catch { return ""; } })()
  ));
  const [savedFlash, setSavedFlash] = useState(false);
  const [writingStyle, setWritingStyle] = useState<WritingStyle>({
    fontFamily: "Georgia, serif",
    fontSize: 18,
    lineHeight: 1.75,
    paragraphMode: "none",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const savedFlashTimeoutRef = useRef<number | null>(null);
  // Pending cursor position after an Enter-key paragraph insert
  const pendingCursorRef = useRef<number | null>(null);

  const {
    room,
    participantId,
    isConnected,
    error,
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

  // Clear autosave when the sprint ends so stale drafts don't persist
  useEffect(() => {
    if (room?.status === "finished" && code) {
      try { localStorage.removeItem(autoSaveKey(code)); } catch { /* ignore */ }
    }
  }, [room?.status, code]);

  // ── Core text update ───────────────────────────────────────────────────

  const applyText = useCallback((newText: string) => {
    const wc = countWords(newText);
    setText(newText);
    setWordCount(wc);
    setLatestText(newText);

    // Optimistic car movement
    if (participantId) updateLocalWordCount(participantId, wc);

    // Debounced server sync
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = window.setTimeout(() => sendTextUpdate(newText), 100);

    // Debounced autosave to localStorage
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      try {
        if (newText) {
          localStorage.setItem(autoSaveKey(code), newText);
        } else {
          localStorage.removeItem(autoSaveKey(code));
        }
      } catch { /* storage full / private mode */ }

      // Flash "Saved" badge
      setSavedFlash(true);
      if (savedFlashTimeoutRef.current) clearTimeout(savedFlashTimeoutRef.current);
      savedFlashTimeoutRef.current = window.setTimeout(() => setSavedFlash(false), 1800);
    }, 1500);
  }, [code, participantId, setLatestText, sendTextUpdate, updateLocalWordCount]);

  // ── Handlers ───────────────────────────────────────────────────────────

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

    let insertion: string;
    if (writingStyle.paragraphMode === "indent") {
      // Newline + 4-space indent on the next line
      insertion = "\n    ";
    } else {
      // Double: blank line between paragraphs
      insertion = "\n\n";
    }

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

  // ── Render ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="space-y-4 mt-2">
            <p>{error}</p>
            <Button variant="outline" onClick={() => setLocation("/")} className="w-full">
              Return Home
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-muted-foreground space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Connecting to sprint room...</p>
      </div>
    );
  }

  const isCreator =
    room.participants.find((p) => p.id === participantId)?.isCreator || isCreatorParams;

  const isRunning = room.status === "running";
  const isWaiting = room.status === "waiting";
  const isFinished = room.status === "finished";

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
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Room:</span>
            <code className="font-mono text-sm font-bold bg-muted px-2 py-0.5 rounded select-all">
              {code}
            </code>
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
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  disabled={!isRunning || !isConnected}
                  placeholder={
                    !isConnected
                      ? "Reconnecting..."
                      : isRunning
                      ? "Start writing here..."
                      : "Waiting for the sprint to start..."
                  }
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full h-full resize-none bg-card border rounded-b-lg shadow-sm p-6 md:p-8 focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: writingStyle.fontFamily,
                    fontSize: `${writingStyle.fontSize}px`,
                    lineHeight: writingStyle.lineHeight,
                    borderTop: "none",
                  }}
                />

                {/* Bottom-right badge row */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-none">
                  {/* Auto-save flash */}
                  <div
                    className="bg-background/90 backdrop-blur border px-2 py-1 rounded text-[10px] font-medium text-muted-foreground transition-opacity duration-500"
                    style={{ opacity: savedFlash ? 1 : 0 }}
                  >
                    Saved
                  </div>

                  {/* Word count */}
                  <div className="bg-background/90 backdrop-blur border px-3 py-1.5 rounded-md shadow-sm flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-lg">{wordCount}</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">words</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="md:col-span-1 flex flex-col gap-4">
              <Timer timeLeft={room.timeLeft} status={room.status} />

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
                    Waiting for the host to start the sprint...
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
