import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useSprintRoom } from "@/hooks/useSprintRoom";
import { RaceTrack } from "@/components/RaceTrack";
import { Timer } from "@/components/Timer";
import { ResultsScreen } from "@/components/ResultsScreen";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, AlertCircle, Loader2, Play } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// Simple hook to parse search params
function useSearchParams() {
  return useMemo(() => new URLSearchParams(window.location.search), [window.location.search]);
}

export default function Room() {
  const [location, setLocation] = useLocation();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const code = searchParams.get("code") || "";
  const name = searchParams.get("name") || "";
  const isCreatorParams = searchParams.get("isCreator") === "true";

  const [text, setText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const debounceTimeoutRef = useRef<number | null>(null);

  const {
    room,
    participantId,
    isConnected,
    error,
    sendTextUpdate,
    startSprint,
    restartSprint,
    endSprint,
  } = useSprintRoom({ code, name, isCreator: isCreatorParams });

  // Redirect if missing essential info
  useEffect(() => {
    if (!code || !name) {
      setLocation("/");
    }
  }, [code, name, setLocation]);

  // Word counter
  const countWords = (str: string) => {
    const matches = str.match(/\b\w+\b/g);
    return matches ? matches.length : 0;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    
    // Immediate word count update locally
    const currentWordCount = countWords(newText);
    setWordCount(currentWordCount);

    // Debounced sending to server
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = window.setTimeout(() => {
      sendTextUpdate(newText);
    }, 300);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Room code copied to clipboard",
    });
  };

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

  if (!room || !isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-muted-foreground space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Connecting to sprint room...</p>
      </div>
    );
  }

  const isCreator = room.participants.find(p => p.id === participantId)?.isCreator || isCreatorParams;

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto flex flex-col p-4 md:p-6 lg:p-8 gap-6">
      
      {/* Header bar */}
      <header className="flex items-center justify-between bg-card border rounded-lg px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="font-serif font-bold text-xl text-foreground">Writing Sprint</h1>
          <div className="h-4 w-px bg-border hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Room:</span>
            <code className="font-mono text-sm font-bold bg-muted px-2 py-1 rounded select-all">
              {code}
            </code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyRoomCode}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {room.participants.slice(0, 3).map(p => (
              <div key={p.id} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-xs font-bold text-primary" title={p.name}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {room.participants.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-medium text-muted-foreground">
                +{room.participants.length - 3}
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-muted-foreground ml-2">
            {room.participants.length} {room.participants.length === 1 ? 'writer' : 'writers'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      {room.status === "finished" ? (
        <div className="flex-1 flex items-center justify-center">
          <ResultsScreen 
            participants={room.participants} 
            currentParticipantId={participantId} 
            isCreator={isCreator} 
            onRestart={restartSprint} 
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6">
          <RaceTrack participants={room.participants} currentParticipantId={participantId} />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1">
            
            <div className="md:col-span-3 flex flex-col gap-2">
              <div className="relative flex-1 min-h-[400px]">
                <Textarea
                  value={text}
                  onChange={handleTextChange}
                  disabled={room.status !== "running"}
                  placeholder={room.status === "running" ? "Start writing here..." : "Waiting for the sprint to start..."}
                  className="w-full h-full resize-none bg-card border shadow-sm text-lg font-serif leading-relaxed p-6 md:p-8 focus-visible:ring-primary/50 text-foreground"
                  spellCheck={false}
                  autoComplete="off"
                />
                
                {/* Word count badge in corner of textarea */}
                <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur border px-3 py-1.5 rounded-md shadow-sm pointer-events-none flex items-baseline gap-1.5">
                  <span className="font-mono font-bold text-lg">{wordCount}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Words</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 flex flex-col gap-6">
              <Timer timeLeft={room.timeLeft} status={room.status} />
              
              {room.status === "waiting" && isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Host Controls</h3>
                  <Button onClick={startSprint} size="lg" className="w-full group">
                    <Play className="w-4 h-4 mr-2" />
                    Start Sprint
                  </Button>
                </div>
              )}

              {room.status === "running" && isCreator && (
                <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Host Controls</h3>
                  <Button onClick={endSprint} variant="destructive" className="w-full">
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
