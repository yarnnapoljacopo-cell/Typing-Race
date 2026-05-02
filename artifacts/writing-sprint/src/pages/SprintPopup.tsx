import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useGuest } from "@/lib/guestContext";
import { useToast } from "@/hooks/use-toast";
import { useCreateRoom } from "@workspace/api-client-react";
import { useSprintRoom } from "@/hooks/useSprintRoom";
import { useAuthedFetch } from "@/lib/authedFetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function countWords(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function fmt(secs: number | null | undefined): string {
  if (secs == null || secs < 0) return "--:--";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  chapterTitle: string | null;
  chapterContent: string;
  onSave: (newContent: string) => void;
}

type Phase = "lobby" | "runner";
type Tab = "create" | "join";

export default function SprintPopup({ open, onClose, chapterTitle, chapterContent, onSave }: Props) {
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { guestName, updateGuestName } = useGuest();
  const { toast } = useToast();
  const authedFetch = useAuthedFetch();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [tab, setTab] = useState<Tab>("create");
  const [duration, setDuration] = useState(15);
  const [joinCode, setJoinCode] = useState("");

  // Active room state (set after create or join)
  const [roomCode, setRoomCode] = useState<string>("");
  const [isCreator, setIsCreator] = useState(false);
  const [text, setText] = useState<string>("");

  const displayName = useMemo(() => {
    if (isSignedIn) return user?.firstName || user?.username || user?.fullName || "Writer";
    return guestName || "Writer";
  }, [isSignedIn, user, guestName]);

  // Make sure we have an identity (guest fallback)
  useEffect(() => {
    if (!open) return;
    if (!isSignedIn && !guestName) {
      updateGuestName(`Writer${Math.floor(Math.random() * 9000) + 1000}`);
    }
  }, [open, isSignedIn, guestName, updateGuestName]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setPhase("lobby");
      setTab("create");
      setJoinCode("");
      setRoomCode("");
      setIsCreator(false);
      setText(chapterContent || "");
    }
  }, [open, chapterContent]);

  // Connect to the room only once we have a code
  const sprint = useSprintRoom({
    code: phase === "runner" ? roomCode : "",
    name: displayName,
    password: undefined,
    clerkUserId: user?.id ?? null,
  });

  const status = sprint.room?.status ?? "waiting";
  const timeLeft = sprint.room?.timeLeft ?? null;
  const countdownLeft = sprint.room?.countdownTimeLeft ?? null;
  const participants = sprint.room?.participants ?? [];
  const wordCount = countWords(text);

  // Push word counts / text upstream while sprinting
  useEffect(() => {
    if (phase !== "runner" || status !== "running") return;
    sprint.sendTextUpdate(text, wordCount);
  }, [text, wordCount, status, phase, sprint]);

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        setRoomCode(data.code);
        setIsCreator(true);
        setPhase("runner");
      },
      onError: (err) => {
        toast({
          title: "Failed to create room",
          description: err.message || "An unexpected error occurred",
          variant: "destructive",
        });
      },
    },
  });

  const handleCreate = () => {
    createRoomMutation.mutate({
      data: {
        creatorName: displayName,
        durationMinutes: duration,
        mode: "regular",
      } as Parameters<typeof createRoomMutation.mutate>[0]["data"],
    });
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast({ title: "Room code required", variant: "destructive" });
      return;
    }
    try {
      const res = await authedFetch(`${basePath}/api/rooms/${encodeURIComponent(code)}`);
      if (!res.ok) {
        toast({ title: "Room not found", description: "Check the code and try again.", variant: "destructive" });
        return;
      }
    } catch {
      // proceed; WS will surface errors
    }
    setRoomCode(code);
    setIsCreator(false);
    setPhase("runner");
  };

  const handleSaveBack = () => {
    onSave(text);
    if (phase === "runner") sprint.endSprint();
    onClose();
  };

  const handleLeave = () => {
    if (phase === "runner") sprint.endSprint();
    onClose();
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    toast({ title: "Code copied", description: roomCode });
  };

  if (!open) return null;

  return (
    <div className="sprint-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sprint-modal sprint-modal--native">
        <div className="sprint-embed-bar">
          <div className="sprint-embed-title">
            Sprint{chapterTitle ? <> · <span className="sprint-embed-chapter">{chapterTitle}</span></> : null}
          </div>
          <button className="sprint-secondary-btn" onClick={handleLeave}>Close</button>
        </div>

        {phase === "lobby" ? (
          <div className="sprint-lobby">
            <h2 className="sprint-lobby-title">Join the session</h2>
            <p className="sprint-lobby-sub">Writing as <strong>{displayName}</strong></p>

            <div className="sprint-tabs">
              <button
                className={`sprint-tab${tab === "join" ? " active" : ""}`}
                onClick={() => setTab("join")}
              >Join Room</button>
              <button
                className={`sprint-tab${tab === "create" ? " active" : ""}`}
                onClick={() => setTab("create")}
              >Create Room</button>
            </div>

            {tab === "create" ? (
              <div className="sprint-form">
                <label className="sprint-label">Sprint length</label>
                <div className="sprint-duration-row">
                  {[5, 10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      className={`sprint-duration-chip${duration === m ? " active" : ""}`}
                      onClick={() => setDuration(m)}
                    >{m} min</button>
                  ))}
                </div>
                <button
                  className="sprint-primary-btn"
                  onClick={handleCreate}
                  disabled={createRoomMutation.isPending}
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </button>
              </div>
            ) : (
              <div className="sprint-form">
                <label className="sprint-label">Room Code</label>
                <input
                  className="sprint-input"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEF"
                  maxLength={8}
                />
                <button className="sprint-primary-btn" onClick={handleJoin}>Enter Room</button>
              </div>
            )}
          </div>
        ) : (
          <div className="sprint-runner">
            <div className="sprint-runner-head">
              <div className="sprint-runner-meta">
                <button className="sprint-code-btn" onClick={copyCode} title="Click to copy">
                  Room <strong>{roomCode}</strong>
                </button>
                <span className="sprint-meta-dot">·</span>
                <span>{participants.length} writer{participants.length === 1 ? "" : "s"}</span>
                {!sprint.isConnected && (
                  <>
                    <span className="sprint-meta-dot">·</span>
                    <span style={{ color: "#c0392b" }}>{sprint.isReconnecting ? "Reconnecting…" : "Connecting…"}</span>
                  </>
                )}
              </div>
              <div className="sprint-runner-timer">
                {status === "countdown" ? `Starts in ${fmt(countdownLeft)}`
                  : status === "running" ? fmt(timeLeft)
                  : status === "finished" ? "Finished"
                  : "Waiting"}
              </div>
            </div>

            <textarea
              className="sprint-runner-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start writing..."
              autoFocus
            />

            <div className="sprint-runner-foot">
              <div className="sprint-runner-stats">
                <strong>{wordCount}</strong> words
              </div>
              <div className="sprint-runner-actions">
                {isCreator && status === "waiting" && (
                  <button
                    className="sprint-primary-btn"
                    onClick={sprint.startSprint}
                    disabled={!sprint.isConnected}
                  >Start Sprint</button>
                )}
                {status === "running" && (
                  <button className="sprint-secondary-btn" onClick={sprint.endSprint}>End Sprint</button>
                )}
                <button className="sprint-primary-btn" onClick={handleSaveBack}>
                  Save to Chapter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
