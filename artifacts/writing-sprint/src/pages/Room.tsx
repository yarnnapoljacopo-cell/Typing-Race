import { useEffect, useState, useRef, useMemo } from "react";
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

function useSearchParams() {
  return useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
}

function countWords(str: string): number {
  const matches = str.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}

export default function Room() {
  const [, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";

  const [text, setText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [writingStyle, setWritingStyle] = useState<WritingStyle>({
    fontFamily: "Georgia, serif",
    fontSize: 18,
    lineHeight: 1.75,
  });

  const debounceTimeoutRef = useRef<number | null>(null);

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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    const wc = countWords(newText);
    setWordCount(wc);

    // Keep hook's ref current for reconnect resync
    setLatestText(newText);

    // Optimistically move car immediately
    if (participantId) {
      updateLocalWordCount(participantId, wc);
    }

    // Debounced send to server
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = window.setTimeout(() => {
      sendTextUpdate(newText);
    }, 100);
  };

  const handleStyleChange = (partial: Partial<WritingStyle>) => {
    setWritingStyle((prev) => ({ ...prev, ...partial }));
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Room code copied to clipboard." });
  };

  // ── Fatal error ──────────────────────────────────────────────────────────
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

  // ── First-time loading (no room yet) ─────────────────────────────────────
  // If we already have a room but lost connection, keep showing the UI instead
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

      {/* Reconnecting banner — shown when WS drops but we have room state */}
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
          <RaceTrack participants={room.participants} currentParticipantId={participantId} />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">

            {/* Writing area */}
            <div className="md:col-span-3 flex flex-col">
              <WritingToolbar style={writingStyle} onChange={handleStyleChange} />
              <div className="relative flex-1 min-h-[380px]">
                <textarea
                  value={text}
                  onChange={handleTextChange}
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

                {/* Word count badge */}
                <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur border px-3 py-1.5 rounded-md shadow-sm pointer-events-none flex items-baseline gap-1.5">
                  <span className="font-mono font-bold text-lg">{wordCount}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">words</span>
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
