import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk, useAuth, SignUpButton, SignInButton } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateRoom } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PenTool, ArrowRight, Loader2, Feather, Eye, Lock, Timer, Target,
  Clock, BookOpen, LogOut, Pencil, Radio, Skull, UserRound, Swords, User, Users, ChevronDown, KeyRound, Crown, WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PastSprints from "./PastSprints";
import ActiveRooms from "./ActiveRooms";
import { useGuest } from "@/lib/guestContext";
import { useVillainMode } from "@/lib/villainModeContext";
import { useSkin } from "@/lib/skinContext";
import { SKINS, type SkinKey } from "@/lib/nameplates";

type RoomMode = "regular" | "open" | "goal" | "boss" | "kart" | "gladiator";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProfileData {
  writerName: string | null;
  xp: number;
  xpDecayed: number;
  inDecay: boolean;
  daysUntilDecay: number | null;
  decayRatePerDay: number;
}

async function fetchProfile(): Promise<ProfileData> {
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
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { guestName, updateGuestName, exitGuest } = useGuest();
  const { isVillainMode, toggleVillainMode } = useVillainMode();
  const { activeSkin, setActiveSkin } = useSkin();
  const [modesOpen, setModesOpen] = useState(false);
  const modesPanelRef = useRef<HTMLDivElement>(null);

  const closeModes = useCallback((e: MouseEvent) => {
    if (modesPanelRef.current && !modesPanelRef.current.contains(e.target as Node)) {
      setModesOpen(false);
    }
  }, []);

  useEffect(() => {
    if (modesOpen) document.addEventListener("mousedown", closeModes);
    return () => document.removeEventListener("mousedown", closeModes);
  }, [modesOpen, closeModes]);

  const isGuest = !isSignedIn && !!guestName;

  const initialTab = new URLSearchParams(window.location.search).get("tab") ?? "sprint";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [joinCode, setJoinCode] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [roomMode, setRoomMode] = useState<RoomMode>("regular");
  const [countdownDelay, setCountdownDelay] = useState<number>(0);
  const [goalWords, setGoalWords] = useState<string>("1000");
  const [bossGoalWords, setBossGoalWords] = useState<string>("5000");
  const [deathModeWpm, setDeathModeWpm] = useState<number | null>(null);
  const [gladiatorDeathGap, setGladiatorDeathGap] = useState<number>(400);
  const [useRoomPassword, setUseRoomPassword] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const [joinPasswordInput, setJoinPasswordInput] = useState("");

  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Holds the password between handleCreate() and onSuccess() so it can be
  // stored in sessionStorage before the creator is navigated into the room.
  const pendingRoomPasswordRef = useRef<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
    enabled: !isGuest,
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
    if (!isGuest && !profileLoading && profile?.writerName === null) {
      const fallback = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "";
      setNameInput(fallback);
      setNameDialogOpen(true);
    }
  }, [isGuest, profileLoading, profile?.writerName, user]);

  // Toast when XP was just lost to Writing Deviation
  useEffect(() => {
    if (!isGuest && !profileLoading && profile?.xpDecayed && profile.xpDecayed > 0) {
      toast({
        title: "Writing Deviation",
        description: `You lost ${profile.xpDecayed} XP for going silent. Write to stop the bleed.`,
        variant: "destructive",
      });
    }
  // Only fire once on first load (profile reference changes when data arrives)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.xpDecayed]);

  const displayName = isGuest
    ? (guestName ?? "Guest")
    : (profile?.writerName || user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Writer");

  const openEditDialog = () => {
    setNameInput(displayName);
    setNameDialogOpen(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      toast({ title: "Name too short", description: "Must be at least 2 characters.", variant: "destructive" });
      return;
    }
    if (isGuest) {
      updateGuestName(trimmed);
      setNameDialogOpen(false);
      toast({ title: "Name updated", description: `You'll appear as "${trimmed}" in sprints.` });
    } else {
      saveMutation.mutate(trimmed);
    }
  };

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        // If the creator set a password, stash it so the Room page can pass it
        // in the join_room WS message (same flow as any other joiner).
        const pw = pendingRoomPasswordRef.current;
        if (pw) {
          sessionStorage.setItem(`room_password_${data.code}`, pw);
          pendingRoomPasswordRef.current = null;
        }
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
    const bossWordGoal = roomMode === "boss" ? (parseInt(bossGoalWords, 10) || 5000) : undefined;
    const pw = useRoomPassword && roomPassword.trim() ? roomPassword.trim() : undefined;
    // Stash password so onSuccess can write it to sessionStorage for the creator's own join
    pendingRoomPasswordRef.current = pw ?? null;
    createRoomMutation.mutate({
      data: {
        creatorName: displayName,
        durationMinutes: duration,
        mode: roomMode === "boss" ? "regular" : roomMode,
        ...(countdownDelay > 0 ? { countdownDelayMinutes: countdownDelay } : {}),
        ...(wordGoal ? { wordGoal } : {}),
        ...(deathModeWpm ? { deathModeWpm } : {}),
        ...(bossWordGoal ? { bossWordGoal } : {}),
        ...(pw ? { roomPassword: pw } : {}),
        ...(roomMode === "gladiator" ? { gladiatorDeathGap } : {}),
      } as Parameters<typeof createRoomMutation.mutate>[0]["data"],
    });
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast({ title: "Room code required", description: "Please enter a valid room code.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${basePath}/api/rooms/${encodeURIComponent(code)}`, { credentials: "include" });
      if (!res.ok) {
        toast({ title: "Room not found", description: "Check the code and try again.", variant: "destructive" });
        return;
      }
      const roomInfo = await res.json();
      if (roomInfo.isPasswordProtected) {
        setPendingJoinCode(code);
        setJoinPasswordInput("");
        setPasswordDialogOpen(true);
        return;
      }
    } catch {
      // If fetch fails, proceed and let the WS connection handle the error
    }
    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}`);
  };

  const handlePasswordJoinConfirm = () => {
    if (!joinPasswordInput.trim()) {
      toast({ title: "Password required", variant: "destructive" });
      return;
    }
    sessionStorage.setItem(`room_password_${pendingJoinCode}`, joinPasswordInput.trim());
    setPasswordDialogOpen(false);
    setLocation(`/room?code=${encodeURIComponent(pendingJoinCode)}&name=${encodeURIComponent(displayName)}`);
  };

  const handleExitGuest = () => {
    exitGuest();
    setLocation("/");
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

        {/* Guest banner */}
        {isGuest && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <UserRound size={15} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 leading-snug">
                Guest mode — sprints won't be saved
              </p>
            </div>
            <SignUpButton mode="modal">
              <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap underline underline-offset-2 transition-colors shrink-0">
                Create account
              </button>
            </SignUpButton>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
          {/* Single modes button — unlocked at Ink Reaper (10k XP) */}
          {!isGuest && (profile?.xp ?? 0) >= 10000 && (
            <div ref={modesPanelRef} className="fixed bottom-5 right-5 z-50">
              {/* Popup panel */}
              {modesOpen && (
                <div className="absolute bottom-14 right-0 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-col gap-0.5 min-w-[185px]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pt-1 pb-1">Skin</p>

                  <button
                    type="button"
                    onClick={() => { setActiveSkin("default"); if (isVillainMode) toggleVillainMode(); }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      activeSkin === "default" && !isVillainMode ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">🖋</span>
                    <span className="flex-1">Default</span>
                    {activeSkin === "default" && !isVillainMode && <span className="text-[10px] text-primary ml-auto">✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { if (!isVillainMode) toggleVillainMode(); if (activeSkin !== "default") setActiveSkin("default"); }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                      isVillainMode ? "bg-red-950/70 text-red-300" : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">🩸</span>
                    <span className="flex-1">Villain Mode</span>
                    {isVillainMode && <span className="text-[10px] text-red-400 ml-auto">✓</span>}
                  </button>

                  {(profile?.xp ?? 0) >= 75000 && (
                    <button
                      type="button"
                      onClick={() => { setActiveSkin("eternal"); if (isVillainMode) toggleVillainMode(); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                        activeSkin === "eternal" && !isVillainMode ? "bg-[#07102a] text-[#60a5fa]" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-base leading-none">✨</span>
                      <span className="flex-1">Eternal Skin</span>
                      {activeSkin === "eternal" && !isVillainMode && <span className="text-[10px] text-[#60a5fa] ml-auto">✓</span>}
                    </button>
                  )}

                  {(profile?.xp ?? 0) >= 200000 && (
                    <button
                      type="button"
                      onClick={() => { setActiveSkin("final"); if (isVillainMode) toggleVillainMode(); }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                        activeSkin === "final" && !isVillainMode ? "bg-[#120e04] text-[#daa520]" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-base leading-none">⚜️</span>
                      <span className="flex-1">Final Skin</span>
                      {activeSkin === "final" && !isVillainMode && <span className="text-[10px] text-[#daa520] ml-auto">✓</span>}
                    </button>
                  )}
                </div>
              )}
              {/* The single trigger button */}
              <button
                type="button"
                onClick={() => setModesOpen((v) => !v)}
                title="Modes"
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shadow-lg border-2 transition-all duration-200 hover:scale-110 active:scale-95 ${
                  modesOpen
                    ? "bg-foreground border-foreground text-background"
                    : isVillainMode
                    ? "bg-red-950 border-red-600"
                    : activeSkin !== "default"
                    ? activeSkin === "final" ? "bg-[#120e04] border-[#daa520]" : "bg-[#07102a] border-[#60a5fa]"
                    : "bg-card border-border hover:border-primary"
                }`}
              >
                {modesOpen ? "✕" : isVillainMode ? "🩸" : activeSkin === "final" ? "⚜️" : activeSkin === "eternal" ? "✨" : "✦"}
              </button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors">
                <span className="font-medium">
                  {(!isGuest && profileLoading) ? "…" : displayName}
                </span>
                <ChevronDown size={13} className="text-muted-foreground mt-px" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem onClick={openEditDialog} className="gap-2">
                <Pencil size={14} className="text-muted-foreground" />
                Edit writer name
              </DropdownMenuItem>
              {!isGuest && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/my-files")} className="gap-2">
                    <BookOpen size={14} className="text-muted-foreground" />
                    My Files
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/friends")} className="gap-2">
                    <Users size={14} className="text-muted-foreground" />
                    Friends
                  </DropdownMenuItem>
                  {profile?.writerName && (
                    <DropdownMenuItem
                      onClick={() => setLocation(`/profile/${encodeURIComponent(profile.writerName!)}`)}
                      className="gap-2"
                    >
                      <User size={14} className="text-muted-foreground" />
                      My Profile
                    </DropdownMenuItem>
                  )}
                  {(profile?.xp ?? 0) >= 200000 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setLocation("/global-ranking")}
                        className="gap-2 text-fuchsia-500 focus:text-fuchsia-500 focus:bg-fuchsia-500/10"
                      >
                        <Crown size={14} />
                        Global Ranking
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={isGuest ? handleExitGuest : () => signOut()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={14} />
            {isGuest ? "Exit guest" : "Sign out"}
          </button>
        </div>

        {/* Writing Deviation warning banner */}
        {!isGuest && !profileLoading && profile && (
          <>
            {profile.inDecay && profile.decayRatePerDay > 0 && (
              <div className="flex items-start gap-2.5 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                <span className="mt-0.5 text-red-400 shrink-0">⚠️</span>
                <div className="leading-snug">
                  <span className="font-semibold text-red-200">Writing Deviation active</span>
                  <span className="text-red-300/80"> — you're bleeding </span>
                  <span className="font-semibold text-red-200">{profile.decayRatePerDay} XP/day</span>
                  <span className="text-red-300/80"> until you sprint again.</span>
                </div>
              </div>
            )}
            {!profile.inDecay && profile.daysUntilDecay !== null && profile.daysUntilDecay <= 2 && (
              <div className="flex items-start gap-2.5 rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-300">
                <span className="mt-0.5 shrink-0">🕰️</span>
                <div className="leading-snug">
                  <span className="font-semibold text-amber-200">Writing Deviation in {profile.daysUntilDecay} day{profile.daysUntilDecay !== 1 ? "s" : ""}</span>
                  <span className="text-amber-300/80"> — sprint now to reset the clock and protect your XP.</span>
                </div>
              </div>
            )}
          </>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isGuest ? (
            <TabsList className="grid w-full grid-cols-2 mb-2">
              <TabsTrigger value="sprint" className="flex items-center gap-1.5">
                <Clock size={14} />
                Sprint
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-1.5">
                <Radio size={14} />
                Active Rooms
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full grid-cols-3 mb-2">
              <TabsTrigger value="sprint" className="flex items-center gap-1.5">
                <Clock size={14} />
                Sprint
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-1.5">
                <Radio size={14} />
                Active Rooms
              </TabsTrigger>
              <TabsTrigger value="past" className="flex items-center gap-1.5">
                <BookOpen size={14} />
                Past Sprints
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="sprint">
            <Card className="border-border shadow-xl shadow-primary/5">
              <CardHeader className="pb-4">
                <CardTitle>Join the session</CardTitle>
                <CardDescription>
                  Writing as <span className="font-semibold text-foreground">{displayName}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Sprint Offline — desktop app only */}
                {!!(window as any).electronAPI && (
                  <button
                    type="button"
                    onClick={() => setLocation("/offline-sprint")}
                    className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-border px-4 py-3.5 text-left hover:border-muted-foreground/40 hover:bg-muted/30 transition-all group"
                  >
                    <div className="rounded-lg bg-muted p-2 group-hover:bg-muted-foreground/10 transition-colors">
                      <WifiOff className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">Sprint Offline</div>
                      <div className="text-xs text-muted-foreground">Full solo sprint · saves locally · no login needed</div>
                    </div>
                    <ArrowRight className="ml-auto w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                )}

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
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                        <button
                          type="button"
                          onClick={() => setRoomMode("boss")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "boss"
                              ? "border-purple-500 bg-purple-500/10 text-purple-400"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <Swords className="w-4 h-4" />
                          <span className="text-xs font-semibold">Boss Battle</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">Defeat the monster</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomMode("kart")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "kart"
                              ? "border-orange-500 bg-orange-500/10 text-orange-400"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <span className="text-base leading-none">🏎️</span>
                          <span className="text-xs font-semibold">Kart Mode</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">Items &amp; chaos</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoomMode("gladiator")}
                          className={`flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
                            roomMode === "gladiator"
                              ? "border-red-600 bg-red-600/10 text-red-400"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}
                        >
                          <span className="text-base leading-none">⚔️</span>
                          <span className="text-xs font-semibold">Gladiator</span>
                          <span className="text-[10px] text-center leading-tight opacity-70">1v1 HP combat</span>
                        </button>
                      </div>

                      {roomMode === "gladiator" && (
                        <div className="mt-3 rounded-lg border border-red-600/30 bg-red-600/5 px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚔️</span>
                            <span className="text-sm font-medium text-foreground">Death Gap</span>
                          </div>
                          <p className="text-[11px] text-red-400/80 leading-relaxed">
                            Both writers start with 1000 HP. Writing heals you. The word gap deals damage. First to fall loses instantly — or whoever has more HP when the timer ends.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { gap: 200, label: "Brutal", desc: "200 words — fastest" },
                              { gap: 400, label: "Aggressive", desc: "400 words" },
                              { gap: 600, label: "Standard", desc: "600 words" },
                              { gap: 800, label: "Epic", desc: "800 words — longest" },
                            ] as const).map(({ gap, label, desc }) => (
                              <button
                                key={gap}
                                type="button"
                                onClick={() => setGladiatorDeathGap(gap)}
                                className={`flex flex-col items-start rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                                  gladiatorDeathGap === gap
                                    ? "border-red-500 bg-red-500/15 text-red-300"
                                    : "border-border text-muted-foreground hover:border-red-800/50"
                                }`}
                              >
                                <span className="text-xs font-bold">{label}</span>
                                <span className="text-[10px] opacity-60">{desc}</span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-white/30 text-center">
                            ⚔️ Chosen death gap will be shown prominently before the sprint starts
                          </p>
                        </div>
                      )}

                      {roomMode === "kart" && (
                        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏎️</span>
                            <span className="text-sm font-medium text-foreground">Kart Mode</span>
                          </div>
                          <p className="text-[11px] text-orange-400/80 leading-relaxed">
                            Earn items every 250 words — Red Shells, Blue Shells, Stars, and the legendary Golden Pen (+400 real bonus words). Last place gets the best items. May the chaos begin!
                          </p>
                        </div>
                      )}

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

                      {roomMode === "boss" && (
                        <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Swords className="w-4 h-4 text-purple-400 shrink-0" />
                            <label className="text-sm font-medium text-foreground shrink-0">Boss HP (words to defeat):</label>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[2500, 5000, 10000, 25000].map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setBossGoalWords(String(w))}
                                className={`flex flex-col items-center rounded-lg border-2 py-2 text-xs font-semibold transition-all ${
                                  bossGoalWords === String(w)
                                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"
                                }`}
                              >
                                {w >= 1000 ? `${w / 1000}k` : w}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={500}
                              max={200000}
                              step={500}
                              value={bossGoalWords}
                              onChange={(e) => setBossGoalWords(e.target.value)}
                              className="h-8 w-28 text-center font-mono focus-visible:ring-purple-500"
                            />
                            <span className="text-sm text-muted-foreground">custom words</span>
                          </div>
                          <p className="text-[10px] text-purple-400/70">Everyone writes together to defeat the boss. Cars are replaced by fighters!</p>
                        </div>
                      )}
                    </div>

                    {/* Death Mode */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Skull className="w-3.5 h-3.5 text-muted-foreground" />
                          Death Mode
                          <span className="text-xs text-muted-foreground font-normal ml-1">(reaper line)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setDeathModeWpm(deathModeWpm ? null : 20)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${deathModeWpm ? "bg-red-500" : "bg-input"}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${deathModeWpm ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                      {deathModeWpm && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-muted-foreground">Reaper speed — fall behind this pace and you're out:</p>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[10, 20, 30, 40, 50].map((wpm) => (
                              <button
                                key={wpm}
                                type="button"
                                onClick={() => setDeathModeWpm(wpm)}
                                className={`flex flex-col items-center rounded-lg border-2 py-2 text-xs font-semibold transition-all ${
                                  deathModeWpm === wpm
                                    ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/40"
                                }`}
                              >
                                <span>{wpm}</span>
                                <span className="text-[9px] font-normal opacity-70">wpm</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Room Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                          Room Password
                          <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => { setUseRoomPassword(!useRoomPassword); setRoomPassword(""); }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${useRoomPassword ? "bg-primary" : "bg-input"}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${useRoomPassword ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                      </div>
                      {useRoomPassword && (
                        <Input
                          type="text"
                          placeholder="Enter a room password"
                          value={roomPassword}
                          onChange={(e) => setRoomPassword(e.target.value)}
                          className="focus-visible:ring-primary font-mono tracking-wide"
                          autoComplete="off"
                        />
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

          <TabsContent value="rooms">
            <ActiveRooms />
          </TabsContent>

          {!isGuest && (
            <TabsContent value="past">
              <PastSprints />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Password prompt when joining a protected room */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <KeyRound size={18} className="text-primary" />
              Room password
            </DialogTitle>
            <DialogDescription>
              This room is protected. Enter the password to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              type="password"
              placeholder="Enter room password"
              value={joinPasswordInput}
              onChange={(e) => setJoinPasswordInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handlePasswordJoinConfirm()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePasswordJoinConfirm} disabled={!joinPasswordInput.trim()}>
                Enter Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isGuest
                ? "Change guest name"
                : (profile?.writerName ? "Change writer name" : "Choose your writer name")}
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
              {(isGuest || profile?.writerName) && (
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
                disabled={(!isGuest && saveMutation.isPending) || nameInput.trim().length < 2}
              >
                {(!isGuest && saveMutation.isPending) ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  (isGuest || profile?.writerName) ? "Save" : "Set name"
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
