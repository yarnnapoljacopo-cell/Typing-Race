import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { useGuest } from "@/lib/guestContext";
import { useToast } from "@/hooks/use-toast";
import { useCreateRoom } from "@workspace/api-client-react";
import { useAuthedFetch } from "@/lib/authedFetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  open: boolean;
  onClose: () => void;
  chapterTitle: string | null;
}

type Tab = "create" | "join";

export default function SprintPopup({ open, onClose, chapterTitle }: Props) {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { guestName, updateGuestName } = useGuest();
  const { toast } = useToast();
  const authedFetch = useAuthedFetch();

  const [tab, setTab] = useState<Tab>("create");
  const [duration, setDuration] = useState(15);
  const [joinCode, setJoinCode] = useState("");

  const displayName = useMemo(() => {
    if (isSignedIn) return user?.firstName || user?.username || user?.fullName || "Writer";
    return guestName || "Writer";
  }, [isSignedIn, user, guestName]);

  // Make sure we have an identity (guest fallback) so the room WS can connect.
  useEffect(() => {
    if (!open) return;
    if (!isSignedIn && !guestName) {
      updateGuestName(`Writer${Math.floor(Math.random() * 9000) + 1000}`);
    }
  }, [open, isSignedIn, guestName, updateGuestName]);

  useEffect(() => {
    if (open) {
      setTab("create");
      setJoinCode("");
    }
  }, [open]);

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        onClose();
        setLocation(`/room?code=${data.code}&name=${encodeURIComponent(displayName)}&isCreator=true`);
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
    onClose();
    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}`);
  };

  if (!open) return null;

  return (
    <div className="sprint-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sprint-modal sprint-modal--native">
        <div className="sprint-embed-bar">
          <div className="sprint-embed-title">
            Sprint{chapterTitle ? <> · <span className="sprint-embed-chapter">{chapterTitle}</span></> : null}
          </div>
          <button className="sprint-secondary-btn" onClick={onClose}>Close</button>
        </div>

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
                {createRoomMutation.isPending ? "Creating..." : "Start Sprint"}
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
      </div>
    </div>
  );
}
