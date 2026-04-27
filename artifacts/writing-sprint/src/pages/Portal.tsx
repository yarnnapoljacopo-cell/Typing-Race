import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk, useAuth, SignUpButton } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateRoom } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
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
  ArrowRight, Loader2, Eye, Lock, Timer, Target,
  BookOpen, LogOut, Pencil, Skull, Swords, User, Users, ChevronDown, KeyRound, Crown,
  ShoppingBag, Clock, Radio, UserRound,
} from "lucide-react";
import { CoinBalance } from "@/components/CoinBalance";
import { useToast } from "@/hooks/use-toast";
import PastSprints from "./PastSprints";
import ActiveRooms from "./ActiveRooms";
import { useGuest } from "@/lib/guestContext";
import { useVillainMode } from "@/lib/villainModeContext";
import { useSkin } from "@/lib/skinContext";
import { Navbar } from "@/components/Navbar";

type RoomMode = "regular" | "open" | "goal" | "boss" | "kart" | "gladiator";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Design tokens — use CSS variables so dark mode is automatic ────────────
const C = {
  cream: "var(--bg-solid)",
  ink: "var(--color-foreground)",
  blueSoft: "#6B8FD4",
  blueLight: "#dce6f7",
  gold: "#E8A838",
  muted: "var(--color-muted-foreground)",
  border: "var(--color-border)",
  cardBg: "var(--color-card)",
};

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

// ── Sub-components ──────────────────────────────────────────────────────────

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 30, height: 30, color: C.blueSoft }}>
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

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
  const [joinMode, setJoinMode] = useState<"join" | "create">("join");

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

  const pendingRoomPasswordRef = useRef<string | null>(null);

  const { data: profile, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
    enabled: !isGuest,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
    // Keep last-known profile visible during background refetches so the
    // portal doesn't flash back to a loading/empty state on token refreshes.
    placeholderData: (prev) => prev,
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
    if (isGuest || profileLoading || profileError) return;
    if (profile?.writerName === null) {
      const fallback = user?.firstName || user?.username || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "";
      setNameInput(prev => prev || fallback);
      setNameDialogOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, profileLoading, profileError, profile?.writerName]);

  useEffect(() => {
    if (!isGuest && !profileLoading && profile?.xpDecayed && profile.xpDecayed > 0) {
      toast({
        title: "Writing Deviation",
        description: `You lost ${profile.xpDecayed} XP for going silent. Write to stop the bleed.`,
        variant: "destructive",
      });
    }
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />

      {/* ── Fixed background ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "var(--bg-solid)" }} />

      {/* grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(var(--bg-grid-color) 1px, transparent 1px), linear-gradient(90deg, var(--bg-grid-color) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* orbs */}
      <div style={{ position: "fixed", width: 520, height: 520, borderRadius: "50%", filter: "blur(80px)", background: "var(--bg-orb1)", top: -100, right: -80, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 380, height: 380, borderRadius: "50%", filter: "blur(80px)", background: "var(--bg-orb2)", bottom: -80, left: -60, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 280, height: 280, borderRadius: "50%", filter: "blur(80px)", background: "var(--bg-orb3)", bottom: 100, right: 60, zIndex: 0, pointerEvents: "none" }} />

      {/* rings */}
      <div style={{ position: "fixed", width: 700, height: 700, borderRadius: "50%", border: "1.5px solid var(--bg-ring1)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", border: "1.5px solid var(--bg-ring2)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 0, pointerEvents: "none" }} />

      {/* ── Scrollable content ── */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", paddingTop: 80, paddingBottom: 32 }}>
        <div className="portal-fade-up" style={{ width: "100%", maxWidth: 460, padding: "0 20px", fontFamily: "'DM Sans', sans-serif" }}>

          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div className="portal-logo-float" style={{
              width: 64, height: 64,
              background: "linear-gradient(135deg, #dce6f7 0%, #c5d8f5 100%)",
              borderRadius: 18,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 24px rgba(107,143,212,0.22), 0 1px 0 rgba(255,255,255,0.9) inset",
            }}>
              <PenIcon />
            </div>
          </div>

          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "3rem", fontWeight: 900, color: "var(--color-foreground)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              Writing Sprint
            </h1>
            <p style={{ fontSize: "0.97rem", color: "var(--color-muted-foreground)", fontWeight: 300, letterSpacing: "0.02em", marginTop: 8 }}>
              Race against fellow writers. Find your flow.
            </p>
          </div>

          {/* Guest banner */}
          {isGuest && (
            <div style={{ margin: "16px 0", borderRadius: 12, border: "1px solid rgba(232,168,56,0.3)", background: "rgba(255,248,230,0.8)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserRound size={14} style={{ color: "#b45309", flexShrink: 0 }} />
                <p style={{ fontSize: "0.85rem", color: "#92400e", lineHeight: 1.4 }}>Guest mode — sprints won't be saved</p>
              </div>
              <SignUpButton mode="modal">
                <button style={{ fontSize: "0.8rem", fontWeight: 700, color: "#92400e", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}>
                  Create account
                </button>
              </SignUpButton>
            </div>
          )}

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 18px", padding: "0 2px" }}>

            {/* Coins */}
            {isSignedIn ? (
              <CoinBalance />
            ) : (
              <div style={{ width: 10 }} />
            )}

            {/* Username dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button style={{
                  background: "rgba(255,255,255,0.9)",
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 999,
                  padding: "6px 14px 6px 12px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.9rem", fontWeight: 600, color: C.ink,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 2px 12px rgba(107,143,212,0.10)",
                  transition: "all 0.2s",
                }}>
                  {(!isGuest && profileLoading) ? "…" : displayName}
                  <ChevronDown size={14} style={{ color: C.muted }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" style={{ minWidth: 200 }}>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/shop")} className="gap-2">
                      <ShoppingBag size={14} className="text-muted-foreground" />
                      Shop
                    </DropdownMenuItem>
                    {profile?.writerName && (
                      <DropdownMenuItem onClick={() => setLocation(`/profile/${encodeURIComponent(profile.writerName!)}`)} className="gap-2">
                        <User size={14} className="text-muted-foreground" />
                        My Profile
                      </DropdownMenuItem>
                    )}
                    {(profile?.xp ?? 0) >= 200000 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setLocation("/global-ranking")} className="gap-2 text-fuchsia-500 focus:text-fuchsia-500 focus:bg-fuchsia-500/10">
                          <Crown size={14} />
                          Global Ranking
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sign out */}
            <button
              onClick={isGuest ? handleExitGuest : () => signOut()}
              style={{
                background: "none", border: "none",
                display: "flex", alignItems: "center", gap: 6,
                color: C.muted, fontSize: "0.85rem",
                fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer", transition: "color 0.2s",
                flexShrink: 0,
              }}
            >
              <LogOut size={14} />
              {isGuest ? "Exit guest" : "Sign out"}
            </button>
          </div>

          {/* Writing Deviation banners */}
          {!isGuest && !profileLoading && profile && (
            <>
              {profile.inDecay && profile.decayRatePerDay > 0 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 10, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(127,29,29,0.18)", padding: "10px 14px", marginBottom: 14, fontSize: "0.85rem", color: "#fca5a5" }}>
                  <span style={{ marginTop: 1, flexShrink: 0 }}>⚠️</span>
                  <div style={{ lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: "#fecaca" }}>Writing Deviation active</span>
                    <span style={{ color: "rgba(252,165,165,0.8)" }}> — you're bleeding </span>
                    <span style={{ fontWeight: 600, color: "#fecaca" }}>{profile.decayRatePerDay} XP/day</span>
                    <span style={{ color: "rgba(252,165,165,0.8)" }}> until you sprint again.</span>
                  </div>
                </div>
              )}
              {!profile.inDecay && profile.daysUntilDecay !== null && profile.daysUntilDecay <= 2 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 10, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(120,53,15,0.15)", padding: "10px 14px", marginBottom: 14, fontSize: "0.85rem", color: "#fcd34d" }}>
                  <span style={{ flexShrink: 0 }}>🕰️</span>
                  <div style={{ lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600, color: "#fde68a" }}>Writing Deviation in {profile.daysUntilDecay} day{profile.daysUntilDecay !== 1 ? "s" : ""}</span>
                    <span style={{ color: "rgba(252,211,77,0.8)" }}> — sprint now to reset the clock and protect your XP.</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Tab nav ── */}
          <div style={{
            display: "flex",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(107,143,212,0.13)",
            borderRadius: 14, padding: 4,
            marginBottom: 18,
            backdropFilter: "blur(12px)",
          }}>
            {[
              { key: "sprint", label: "Sprint", icon: <Clock size={14} /> },
              { key: "rooms", label: "Active Rooms", icon: <Radio size={14} /> },
              ...(!isGuest ? [{ key: "past", label: "Past Sprints", icon: <BookOpen size={14} /> }] : []),
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  flex: 1, background: activeTab === key ? "white" : "none",
                  border: "none",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "0.84rem", fontWeight: activeTab === key ? 600 : 500,
                  color: activeTab === key ? C.ink : C.muted,
                  padding: "9px 6px", borderRadius: 10,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.22s",
                  boxShadow: activeTab === key ? "0 2px 12px rgba(107,143,212,0.14)" : "none",
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* ── Sprint tab ── */}
          {activeTab === "sprint" && (
            <div style={{
              background: C.cardBg,
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.9)",
              borderRadius: 22, padding: "28px 26px",
              boxShadow: "0 8px 40px rgba(107,143,212,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
            }}>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, #e8f0fc, #d4e3fa)",
                border: "1px solid rgba(107,143,212,0.2)",
                borderRadius: 999, padding: "4px 12px",
                fontSize: "0.75rem", fontWeight: 600, color: C.blueSoft,
                letterSpacing: "0.04em", marginBottom: 16,
                textTransform: "uppercase" as const,
              }}>
                <div className="portal-badge-dot" />
                Session open
              </div>

              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.ink, marginBottom: 3 }}>Join the session</div>
              <div style={{ fontSize: "0.84rem", color: C.muted, marginBottom: 22 }}>
                Writing as <strong style={{ color: C.ink }}>{displayName}</strong>
              </div>

              {/* Mode toggle */}
              <div style={{ display: "flex", background: "#f0f0f5", borderRadius: 12, padding: 3, marginBottom: 22 }}>
                {(["join", "create"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setJoinMode(m)}
                    style={{
                      flex: 1, border: "none",
                      background: joinMode === m ? "white" : "none",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.9rem", fontWeight: joinMode === m ? 700 : 500,
                      color: joinMode === m ? C.ink : C.muted,
                      padding: 10, borderRadius: 9,
                      cursor: "pointer", transition: "all 0.22s",
                      boxShadow: joinMode === m ? "0 2px 10px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {m === "join" ? "Join Room" : "Create Room"}
                  </button>
                ))}
              </div>

              {/* ── Join flow ── */}
              {joinMode === "join" && (
                <>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 8 }}>
                    Room Code
                  </div>
                  <input
                    type="text"
                    placeholder="SPRINT-XXXX"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    autoComplete="off"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.7)",
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 13, padding: "14px 18px",
                      fontFamily: "'DM Sans', monospace",
                      fontSize: "1rem", letterSpacing: "0.1em",
                      color: C.ink, textAlign: "center",
                      outline: "none",
                      transition: "all 0.22s", marginBottom: 20, display: "block",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = C.blueSoft;
                      e.target.style.background = "white";
                      e.target.style.boxShadow = "0 0 0 4px rgba(107,143,212,0.12)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = C.border;
                      e.target.style.background = "rgba(255,255,255,0.7)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    onClick={handleJoin}
                    disabled={!joinCode.trim()}
                    style={{
                      width: "100%",
                      background: joinCode.trim() ? "linear-gradient(135deg, #7fa4e0 0%, #5a82d0 100%)" : "#c8d4e8",
                      border: "none", borderRadius: 14, padding: 16,
                      color: "white",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem", fontWeight: 700,
                      cursor: joinCode.trim() ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      boxShadow: joinCode.trim() ? "0 6px 24px rgba(90,130,208,0.35), 0 1px 0 rgba(255,255,255,0.25) inset" : "none",
                      transition: "all 0.22s",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    Enter Room
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {/* ── Create flow ── */}
              {joinMode === "create" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                  {/* Duration */}
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                      Sprint Duration
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[30, 45, 60].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          style={{
                            border: duration === d ? `2px solid ${C.blueSoft}` : `2px solid ${C.border}`,
                            borderRadius: 12, padding: "12px 0",
                            background: duration === d ? "rgba(107,143,212,0.08)" : "rgba(255,255,255,0.5)",
                            color: duration === d ? C.blueSoft : C.ink,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "0.9rem", fontWeight: duration === d ? 700 : 500,
                            cursor: "pointer", transition: "all 0.18s",
                          }}
                        >
                          {d} min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pre-sprint timer */}
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Timer size={13} style={{ color: C.muted }} />
                      Pre-sprint Timer
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.75rem" }}>(auto-starts after)</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                      {[0, 5, 10, 15].map((d) => (
                        <button key={d} onClick={() => setCountdownDelay(d)} style={timerBtnStyle(countdownDelay === d)}>
                          {d === 0 ? "Off" : `${d}m`}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {[20, 25, 30].map((d) => (
                        <button key={d} onClick={() => setCountdownDelay(d)} style={timerBtnStyle(countdownDelay === d)}>
                          {d}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sprint Mode */}
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
                      Sprint Mode
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <ModeCard mode="regular" active={roomMode === "regular"} icon={<Lock size={16} />} label="Regular" desc="Private writing" onClick={() => setRoomMode("regular")} />
                      <ModeCard mode="open" active={roomMode === "open"} icon={<Eye size={16} />} label="Spectator" desc="See each other live" onClick={() => setRoomMode("open")} />
                      <ModeCard mode="goal" active={roomMode === "goal"} icon={<Target size={16} />} label="Goal" desc="Hit a word target" onClick={() => setRoomMode("goal")} />
                      <ModeCard mode="boss" active={roomMode === "boss"} icon={<Swords size={16} />} label="Boss Battle" desc="Defeat the monster" onClick={() => setRoomMode("boss")} color="purple" />
                      <ModeCard mode="kart" active={roomMode === "kart"} icon={<span style={{ fontSize: 16, lineHeight: 1 }}>🏎️</span>} label="Kart Mode" desc="Items & chaos" onClick={() => setRoomMode("kart")} color="orange" />
                      <ModeCard mode="gladiator" active={roomMode === "gladiator"} icon={<span style={{ fontSize: 16, lineHeight: 1 }}>⚔️</span>} label="Gladiator" desc="1v1 HP combat" onClick={() => setRoomMode("gladiator")} color="red" />
                    </div>

                    {roomMode === "gladiator" && (
                      <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.05)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span>⚔️</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: C.ink }}>Death Gap</span>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "rgba(252,165,165,0.9)", lineHeight: 1.5, marginBottom: 10 }}>
                          Both writers start with 1000 HP. Writing heals you. The word gap deals damage. First to fall loses instantly.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {([
                            { gap: 200, label: "Brutal", desc: "200 words — fastest" },
                            { gap: 400, label: "Aggressive", desc: "400 words" },
                            { gap: 600, label: "Standard", desc: "600 words" },
                            { gap: 800, label: "Epic", desc: "800 words — longest" },
                          ] as const).map(({ gap, label, desc }) => (
                            <button key={gap} onClick={() => setGladiatorDeathGap(gap)} style={{
                              display: "flex", flexDirection: "column", alignItems: "flex-start",
                              borderRadius: 10, border: gladiatorDeathGap === gap ? "2px solid #ef4444" : `2px solid ${C.border}`,
                              padding: "8px 12px", textAlign: "left", cursor: "pointer", transition: "all 0.18s",
                              background: gladiatorDeathGap === gap ? "rgba(239,68,68,0.12)" : "transparent",
                            }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: gladiatorDeathGap === gap ? "#f87171" : C.ink }}>{label}</span>
                              <span style={{ fontSize: "0.7rem", color: C.muted }}>{desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {roomMode === "kart" && (
                      <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.05)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span>🏎️</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: C.ink }}>Kart Mode</span>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "rgba(251,146,60,0.9)", lineHeight: 1.5 }}>
                          Earn items every 250 words — Red Shells, Blue Shells, Stars, and the legendary Golden Pen (+400 real bonus words). May the chaos begin!
                        </p>
                      </div>
                    )}

                    {roomMode === "goal" && (
                      <div style={{ marginTop: 12, borderRadius: 12, border: `1px solid rgba(107,143,212,0.25)`, background: "rgba(107,143,212,0.05)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                        <Target size={16} style={{ color: C.blueSoft, flexShrink: 0 }} />
                        <label style={{ fontSize: "0.88rem", fontWeight: 600, color: C.ink, flexShrink: 0 }}>Word target:</label>
                        <Input type="number" min={50} max={50000} step={50} value={goalWords} onChange={(e) => setGoalWords(e.target.value)} className="h-8 w-24 text-center font-mono focus-visible:ring-primary" />
                        <span style={{ fontSize: "0.85rem", color: C.muted }}>words</span>
                      </div>
                    )}

                    {roomMode === "boss" && (
                      <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.05)", padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Swords size={15} style={{ color: "#c084fc", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: C.ink }}>Boss HP (words to defeat)</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
                          {[2500, 5000, 10000, 25000].map((w) => (
                            <button key={w} onClick={() => setBossGoalWords(String(w))} style={{
                              borderRadius: 10, border: bossGoalWords === String(w) ? "2px solid #a855f7" : `2px solid ${C.border}`,
                              padding: "8px 0", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", transition: "all 0.18s",
                              background: bossGoalWords === String(w) ? "rgba(168,85,247,0.15)" : "transparent",
                              color: bossGoalWords === String(w) ? "#c084fc" : C.muted,
                            }}>
                              {w >= 1000 ? `${w / 1000}k` : w}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Input type="number" min={500} max={200000} step={500} value={bossGoalWords} onChange={(e) => setBossGoalWords(e.target.value)} className="h-8 w-28 text-center font-mono" />
                          <span style={{ fontSize: "0.85rem", color: C.muted }}>custom words</span>
                        </div>
                        <p style={{ fontSize: "0.72rem", color: "rgba(192,132,252,0.7)", marginTop: 8 }}>Everyone writes together to defeat the boss.</p>
                      </div>
                    )}
                  </div>

                  {/* Death Mode */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: deathModeWpm ? 10 : 0 }}>
                      <label style={{ fontSize: "0.84rem", fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
                        <Skull size={14} style={{ color: C.muted }} />
                        Death Mode
                        <span style={{ fontSize: "0.75rem", color: C.muted, fontWeight: 400 }}>(reaper line)</span>
                      </label>
                      <button
                        onClick={() => setDeathModeWpm(deathModeWpm ? null : 20)}
                        style={{
                          position: "relative", display: "inline-flex", height: 20, width: 36,
                          borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                          background: deathModeWpm ? "#ef4444" : "#d1d5db", transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 2,
                          left: deathModeWpm ? "calc(100% - 18px)" : 2,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                          transition: "left 0.2s",
                        }} />
                      </button>
                    </div>
                    {deathModeWpm && (
                      <div>
                        <p style={{ fontSize: "0.76rem", color: C.muted, marginBottom: 8 }}>Reaper speed — fall behind this pace and you're out:</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                          {[10, 20, 30, 40, 50].map((wpm) => (
                            <button key={wpm} onClick={() => setDeathModeWpm(wpm)} style={{
                              display: "flex", flexDirection: "column", alignItems: "center",
                              borderRadius: 10, border: deathModeWpm === wpm ? "2px solid #ef4444" : `2px solid ${C.border}`,
                              padding: "8px 0", cursor: "pointer", transition: "all 0.18s",
                              background: deathModeWpm === wpm ? "rgba(239,68,68,0.08)" : "transparent",
                              color: deathModeWpm === wpm ? "#ef4444" : C.muted,
                              fontSize: "0.8rem", fontWeight: 700,
                            }}>
                              <span>{wpm}</span>
                              <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.7 }}>wpm</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Room Password */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: useRoomPassword ? 10 : 0 }}>
                      <label style={{ fontSize: "0.84rem", fontWeight: 600, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
                        <KeyRound size={14} style={{ color: C.muted }} />
                        Room Password
                        <span style={{ fontSize: "0.75rem", color: C.muted, fontWeight: 400 }}>(optional)</span>
                      </label>
                      <button
                        onClick={() => { setUseRoomPassword(!useRoomPassword); setRoomPassword(""); }}
                        style={{
                          position: "relative", display: "inline-flex", height: 20, width: 36,
                          borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                          background: useRoomPassword ? C.blueSoft : "#d1d5db", transition: "background 0.2s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 2,
                          left: useRoomPassword ? "calc(100% - 18px)" : 2,
                          width: 16, height: 16, borderRadius: "50%",
                          background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                          transition: "left 0.2s",
                        }} />
                      </button>
                    </div>
                    {useRoomPassword && (
                      <Input
                        type="text"
                        placeholder="Enter a room password"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="font-mono tracking-wide focus-visible:ring-primary"
                        autoComplete="off"
                      />
                    )}
                  </div>

                  {/* Create CTA */}
                  <button
                    onClick={handleCreate}
                    disabled={createRoomMutation.isPending}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #7fa4e0 0%, #5a82d0 100%)",
                      border: "none", borderRadius: 14, padding: 16,
                      color: "white",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "1rem", fontWeight: 700,
                      cursor: createRoomMutation.isPending ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      boxShadow: "0 6px 24px rgba(90,130,208,0.35), 0 1px 0 rgba(255,255,255,0.25) inset",
                      transition: "all 0.22s",
                      opacity: createRoomMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {createRoomMutation.isPending ? (
                      <><Loader2 className="animate-spin" size={18} /> Creating…</>
                    ) : (
                      <>Start New Session <span style={{ fontSize: "1.1rem" }}>✦</span></>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Active Rooms tab ── */}
          {activeTab === "rooms" && <ActiveRooms />}

          {/* ── Past Sprints tab ── */}
          {activeTab === "past" && !isGuest && <PastSprints />}

        </div>
      </div>

      {/* ── Villain / skin mode button (fixed) ── */}
      {!isGuest && (profile?.xp ?? 0) >= 10000 && (
        <div ref={modesPanelRef} style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50 }}>
          {modesOpen && (
            <div style={{
              position: "absolute", bottom: 56, right: 0,
              background: "var(--color-popover)", border: `1px solid ${C.border}`, borderRadius: 14,
              boxShadow: "0 20px 60px rgba(30,30,80,0.14)",
              padding: 8, minWidth: 190, zIndex: 100,
            }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, padding: "4px 8px 6px" }}>Skin</p>
              {[
                { id: "default", label: "Default", icon: "🖋", condition: true, activeWhen: activeSkin === "default" && !isVillainMode },
                { id: "villain", label: "Villain Mode", icon: "🩸", condition: true, activeWhen: isVillainMode },
                { id: "eternal", label: "Eternal Skin", icon: "✨", condition: (profile?.xp ?? 0) >= 75000, activeWhen: activeSkin === "eternal" && !isVillainMode },
                { id: "final", label: "Final Skin", icon: "⚜️", condition: (profile?.xp ?? 0) >= 200000, activeWhen: activeSkin === "final" && !isVillainMode },
              ].filter(s => s.condition).map(({ id, label, icon, activeWhen }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id === "villain") { if (!isVillainMode) toggleVillainMode(); if (activeSkin !== "default") setActiveSkin("default"); }
                    else { if (isVillainMode) toggleVillainMode(); setActiveSkin(id as "default" | "eternal" | "final"); }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: activeWhen ? (id === "villain" ? "rgba(127,29,29,0.6)" : "rgba(107,143,212,0.1)") : "transparent",
                    color: activeWhen ? (id === "villain" ? "#fca5a5" : C.blueSoft) : C.ink,
                    fontSize: "0.88rem", fontWeight: 500, textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {activeWhen && <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setModesOpen((v) => !v)}
            title="Modes"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, cursor: "pointer",
              border: `2px solid ${modesOpen ? C.ink : isVillainMode ? "#dc2626" : activeSkin !== "default" ? (activeSkin === "final" ? "#daa520" : "#60a5fa") : C.border}`,
              background: modesOpen ? C.ink : isVillainMode ? "#450a0a" : activeSkin === "final" ? "#120e04" : activeSkin === "eternal" ? "#07102a" : "var(--color-card)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
          >
            {modesOpen ? "✕" : isVillainMode ? "🩸" : activeSkin === "final" ? "⚜️" : activeSkin === "eternal" ? "✨" : "✦"}
          </button>
        </div>
      )}

      {/* ── Password join dialog ── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <KeyRound size={18} className="text-primary" />
              Room password
            </DialogTitle>
            <DialogDescription>This room is protected. Enter the password to join.</DialogDescription>
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
              <button
                onClick={() => setPasswordDialogOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontSize: "0.9rem", color: C.muted }}
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordJoinConfirm}
                style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, #7fa4e0 0%, #5a82d0 100%)`, color: "white", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}
              >
                Join Room
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit name dialog ── */}
      <Dialog open={nameDialogOpen} onOpenChange={(open) => { if (!open && profile?.writerName) setNameDialogOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Your writer name</DialogTitle>
            <DialogDescription>This is how you'll appear in sprints.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              placeholder="e.g. QuantumScribe"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
            />
            <div className="flex gap-2 justify-end">
              {profile?.writerName && (
                <button
                  onClick={() => setNameDialogOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontSize: "0.9rem", color: C.muted }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveName}
                disabled={saveMutation.isPending}
                style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, #7fa4e0 0%, #5a82d0 100%)`, color: "white", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600, opacity: saveMutation.isPending ? 0.7 : 1 }}
              >
                {saveMutation.isPending ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Helper components & styles ─────────────────────────────────────────────

function timerBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? `2px solid ${C.blueSoft}` : `2px solid ${C.border}`,
    borderRadius: 10, padding: "9px 0",
    background: active ? "rgba(107,143,212,0.08)" : "rgba(255,255,255,0.5)",
    color: active ? C.blueSoft : C.muted,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "0.84rem", fontWeight: active ? 700 : 500,
    cursor: "pointer", transition: "all 0.18s",
  };
}

type ModeColor = "blue" | "purple" | "orange" | "red";

function ModeCard({
  active, icon, label, desc, onClick, color = "blue",
}: {
  mode: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  color?: ModeColor;
}) {
  const palette: Record<ModeColor, { border: string; bg: string; text: string }> = {
    blue:   { border: C.blueSoft, bg: "rgba(107,143,212,0.08)", text: C.blueSoft },
    purple: { border: "#a855f7",  bg: "rgba(168,85,247,0.08)",  text: "#a855f7"  },
    orange: { border: "#f97316",  bg: "rgba(249,115,22,0.08)",  text: "#f97316"  },
    red:    { border: "#ef4444",  bg: "rgba(239,68,68,0.08)",   text: "#ef4444"  },
  };
  const p = palette[color];
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        borderRadius: 12, border: active ? `2px solid ${p.border}` : `2px solid ${C.border}`,
        padding: "12px 8px", cursor: "pointer", transition: "all 0.18s",
        background: active ? p.bg : "rgba(255,255,255,0.4)",
        color: active ? p.text : C.muted,
      }}
    >
      {icon}
      <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: "0.68rem", textAlign: "center", opacity: 0.75, lineHeight: 1.3 }}>{desc}</span>
    </button>
  );
}
