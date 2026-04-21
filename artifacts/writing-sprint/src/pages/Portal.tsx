import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateRoom } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PenTool, ArrowRight, Loader2, Feather, Eye, Lock, Timer, Target,
  Clock, BookOpen, LogOut, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PastSprints from "./PastSprints";

type RoomMode = "regular" | "open" | "goal";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchProfile(): Promise<{ writerName: string | null }> {
  const res = await fetch(`${basePath}/api/user/profile`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

async function saveProfile(writerName: string): Promise<{ writerName: string }> {
  const res = await fetch(`${basePath}/api/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ writerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save");
  }
  return res.json();
}

export default function Portal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  const [joinCode, setJoinCode] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [roomMode, setRoomMode] = useState<RoomMode>("regular");
  const [countdownDelay, setCountdownDelay] = useState<number>(0);
  const [goalWords, setGoalWords] = useState<string>("1000");

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
  });

  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["user-profile"], data);
      setNameDialogOpen(false);
      toast({ title: "Writer name saved", description: `You'll appear as "${data.writerName}" in sprints.` });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save name", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!profileLoading && profile?.writerName === null) {
      const fallback = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "";
      setNameInput(fallback);
      setNameDialogOpen(true);
    }
  }, [profileLoading, profile?.writerName, user]);

  const displayName =
    profile?.writerName ||
    user?.firstName ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Writer";

  const openEditDialog = () => {
    setNameInput(profile?.writerName || displayName);
    setNameDialogOpen(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      toast({ title: "Name too short", description: "Must be at least 2 characters.", variant: "destructive" });
      return;
    }
    saveMutation.mutate(trimmed);
  };

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
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
    const wordGoal = roomMode === "goal" ? (parseInt(goalWords, 10) || 1000) : undefined;
    createRoomMutation.mutate({
      data: {
        creatorName: displayName,
        durationMinutes: duration,
        mode: roomMode,
        ...(countdownDelay > 0 ? { countdownDelayMinutes: countdownDelay } : {}),
        ...(wordGoal ? { wordGoal } : {}),
      } as Parameters<typeof createRoomMutation.mutate>[0]["data"],
    });
  };

  const handleJoin = () => {
    if (!joinCode.trim()) {
      toast({ title: "Room code required", description: "Please enter a valid room code.", variant: "destructive" });
      return;
    }
    setLocation(`/room?code=${encodeURIComponent(joinCode.trim().toUpperCase())}&name=${encodeURIComponent(displayName)}`);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 selection:bg-primary/20">

      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03]">
        <Feather className="w-full h-full max-w-4xl text-primary" strokeWidth={0.5} />
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
            <PenTool size={32} />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tight">Writing Sprint</h1>
          <p className="text-lg text-muted-foreground font-medium">Race against fellow writers. Find your flow.</p>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-foreground">{profileLoading ? "…" : displayName}</span>
              <button
                onClick={openEditDialog}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Edit writer name"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        <Tabs defaultValue="sprint" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="sprint" className="flex items-center gap-1.5">
              <Clock size={14} />
              Sprint
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-1.5">
              <BookOpen size={14} />
              Past Sprints
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sprint">
            <Card className="border-border shadow-xl shadow-primary/5">
              <CardHeader className="pb-4">
                <CardTitle>Join the session</CardTitle>
                <CardDescription>
                  Writing as <span className="font-semibold text-foreground">{displayName}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="join" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="join">Join Room</TabsTrigger>
                    <TabsTrigger value="create">Create Room</TabsTrigger>
                  </TabsList>

                  <TabsContent value="join" className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="code" className="text-sm font-medium text-foreground">Room Code</label>
                      <Input
                        id="code"
                        placeholder="SPRINT-XXXX"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="font-mono text-center tracking-widest text-lg py-6 focus-visible:ring-primary"
                        autoComplete="off"
                        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                      />
                    </div>
                    <Button
                      onClick={handleJoin}
                      className="w-full py-6 text-lg hover-elevate group"
                      disabled={!joinCode.trim()}
                    >
                      Enter Room
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </TabsContent>

                  <TabsContent value="create" className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">Sprint Duration</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[30, 45, 60].map((d) => (
                          <Button
                            key={d}
                            type="button"
                            variant={duration === d ? "default" : "outline"}
                            className="py-6"
                            onClick={() => setDuration(d)}
                          >
                            {d} min
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                        Pre-sprint Timer
                        <span className="text-xs text-muted-foreground font-normal ml-1">(auto-starts after)</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 5, 10, 15].map((d) => (
                          <Button
                            key={d}
                            type="button"
                            variant={countdownDelay === d ? "default" : "outline"}
                            className="py-5 text-sm"
                            onClick={() => setCountdownDelay(d)}
                          >
                            {d === 0 ? "Off" : `${d}m`}
                          </Button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[20, 25, 30].map((d) => (
                          <Button
                            key={d}
                            type="button"
                            variant={countdownDelay === d ? "default" : "outline"}
                            className="py-5 text-sm"
                            onClick={() => setCountdownDelay(d)}
                          >
                            {d}m
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Sprint Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setRoomMode("regular")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "regular"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <Lock className="w-4 h-4" />
                          <span className="text-xs font-semibold">Regular</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">Private writing</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomMode("open")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "open"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-xs font-semibold">Spectator</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">See each other live</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomMode("goal")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "goal"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <Target className="w-4 h-4" />
                          <span className="text-xs font-semibold">Goal</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">Hit a word target</span>
                        </button>
                      </div>

                      {roomMode === "goal" && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                          <Target className="w-4 h-4 text-primary shrink-0" />
                          <label className="text-sm font-medium text-foreground shrink-0">Word target:</label>
                          <Input
                            type="number"
                            min={50}
                            max={50000}
                            step={50}
                            value={goalWords}
                            onChange={(e) => setGoalWords(e.target.value)}
                            className="h-8 w-24 text-center font-mono focus-visible:ring-primary"
                          />
                          <span className="text-sm text-muted-foreground">words</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleCreate}
                      className="w-full py-6 text-lg hover-elevate group"
                      disabled={createRoomMutation.isPending}
                    >
                      {createRoomMutation.isPending ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating…</>
                      ) : (
                        <>
                          Start New Session
                          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past">
            <PastSprints />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {profile?.writerName ? "Change writer name" : "Choose your writer name"}
            </DialogTitle>
            <DialogDescription>
              This is how you'll appear to others in writing rooms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              placeholder="e.g. Virginia Woolf"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              className="text-lg py-5 focus-visible:ring-primary"
              autoFocus
              maxLength={40}
            />
            <div className="flex gap-2">
              {profile?.writerName && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setNameDialogOpen(false)}
                  disabled={saveMutation.isPending}
                >
                  Cancel
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={handleSaveName}
                disabled={saveMutation.isPending || nameInput.trim().length < 2}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  profile?.writerName ? "Save" : "Set name"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">2–40 characters</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
