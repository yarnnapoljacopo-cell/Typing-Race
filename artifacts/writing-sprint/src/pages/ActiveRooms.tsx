import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Clock, Target, Eye, Lock, Radio } from "lucide-react";

interface ActiveRoom {
  code: string;
  creatorName: string;
  durationMinutes: number;
  mode: "regular" | "open" | "goal";
  wordGoal: number | null;
  status: "waiting" | "countdown" | "running";
  participantCount: number;
  timeLeft: number | null;
  countdownTimeLeft: number | null;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchActiveRooms(): Promise<ActiveRoom[]> {
  const res = await fetch(`${basePath}/api/rooms`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load rooms");
  return res.json();
}

async function fetchProfile(): Promise<{ writerName: string | null }> {
  const res = await fetch(`${basePath}/api/user/profile`, { credentials: "include" });
  if (!res.ok) return { writerName: null };
  return res.json();
}

function formatTimeLeft(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ModeIcon({ mode }: { mode: ActiveRoom["mode"] }) {
  if (mode === "open") return <Eye className="w-3.5 h-3.5" />;
  if (mode === "goal") return <Target className="w-3.5 h-3.5" />;
  return <Lock className="w-3.5 h-3.5" />;
}

function StatusBadge({ room }: { room: ActiveRoom }) {
  if (room.status === "running") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 text-xs font-medium">
        <Radio className="w-2.5 h-2.5 animate-pulse" />
        Live · {room.timeLeft !== null ? formatTimeLeft(room.timeLeft) + " left" : "Running"}
      </Badge>
    );
  }
  if (room.status === "countdown") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-medium">
        Starting in {room.countdownTimeLeft !== null ? formatTimeLeft(room.countdownTimeLeft) : "…"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
      Waiting to start
    </Badge>
  );
}

export default function ActiveRooms() {
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
  });

  const { data: rooms, isLoading, isError, refetch } = useQuery({
    queryKey: ["active-rooms"],
    queryFn: fetchActiveRooms,
    refetchInterval: 5000,
  });

  const displayName =
    profile?.writerName ||
    user?.firstName ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Writer";

  const handleJoin = (code: string) => {
    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Couldn't load active rooms.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
          <Radio size={24} />
        </div>
        <p className="text-lg font-serif font-semibold text-foreground">No active rooms</p>
        <p className="text-sm text-muted-foreground">Create a room from the Sprint tab to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">Updates every 5 seconds</p>

      {rooms.map((room) => (
        <div
          key={room.code}
          className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-primary tracking-wide">{room.code}</span>
                <StatusBadge room={room} />
              </div>
              <p className="text-xs text-muted-foreground">Created by {room.creatorName}</p>
            </div>
            <Button
              size="sm"
              onClick={() => handleJoin(room.code)}
              className="shrink-0"
            >
              Join
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {room.durationMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {room.participantCount} {room.participantCount === 1 ? "writer" : "writers"}
            </span>
            <span className="flex items-center gap-1">
              <ModeIcon mode={room.mode} />
              {room.mode === "regular" ? "Regular" : room.mode === "open" ? "Spectator" : `Goal · ${room.wordGoal?.toLocaleString()} words`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
