import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { useGuest } from "@/lib/guestContext";
import { useToast } from "@/hooks/use-toast";
import { useCreateRoom } from "@workspace/api-client-react";
import { useAuthedFetch } from "@/lib/authedFetch";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Tab = "join" | "create";
type ModeKey = "regular" | "spectator" | "goal" | "boss" | "kart" | "gladiator";

interface ModeDef {
  key: ModeKey;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

const MODES: ModeDef[] = [
  { key: "regular", label: "Regular", desc: "Private writing", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
  )},
  { key: "spectator", label: "Spectator", desc: "See each other live", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  )},
  { key: "goal", label: "Goal", desc: "Hit a word target", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
  )},
  { key: "boss", label: "Boss Battle", desc: "Defeat the monster", icon: (
    <span style={{ fontSize: 16, lineHeight: 1 }}>🗡️</span>
  )},
  { key: "kart", label: "Kart Mode", desc: "Items & chaos", icon: (
    <span style={{ fontSize: 16, lineHeight: 1 }}>🏎️</span>
  )},
  { key: "gladiator", label: "Gladiator", desc: "1v1 HP combat", icon: (
    <span style={{ fontSize: 16, lineHeight: 1 }}>⚔️</span>
  )},
];

const DURATIONS = [30, 45, 60];
const COUNTDOWNS: { label: string; value: number }[] = [
  { label: "Off", value: 0 },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "15m", value: 15 },
  { label: "20m", value: 20 },
  { label: "25m", value: 25 },
  { label: "30m", value: 30 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  chapterTitle: string | null;
  chapterContent?: string;
  /**
   * If set, the "Create" tab posts to /api/guilds/:guildId/sprint instead of
   * /api/rooms. The Join tab is hidden so leaders only start guild sprints
   * here. Members are NOT auto-redirected — they get a chat announcement +
   * GuildBell badge instead.
   */
  guildId?: number;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainToHtml(s: string) {
  if (!s) return "";
  return escapeHtml(s).replace(/\r?\n/g, "<br>");
}

export default function SprintPopup({ open, onClose, chapterTitle: _chapterTitle, chapterContent, guildId }: Props) {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const { guestName, updateGuestName } = useGuest();
  const { toast } = useToast();
  const authedFetch = useAuthedFetch();

  const [tab, setTab] = useState<Tab>("create");
  const [duration, setDuration] = useState(30);
  const [countdown, setCountdown] = useState(0);
  const [mode, setMode] = useState<ModeKey>("regular");
  const [deathOn, setDeathOn] = useState(false);
  const [deathWpm, setDeathWpm] = useState<string>("15");
  const [pwOn, setPwOn] = useState(false);
  const [pw, setPw] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const displayName = useMemo(() => {
    if (isSignedIn) return user?.firstName || user?.username || user?.fullName || "Writer";
    return guestName || "Writer";
  }, [isSignedIn, user, guestName]);

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

  const isGuildFlow = typeof guildId === "number";
  const [guildSubmitting, setGuildSubmitting] = useState(false);

  const createRoomMutation = useCreateRoom({
    mutation: {
      onSuccess: (data) => {
        if (pwOn && pw.trim()) {
          try { sessionStorage.setItem(`room_password_${data.code}`, pw.trim()); } catch { /* ignore */ }
        }
        const seed = (chapterContent || "").trim();
        if (seed) {
          try { localStorage.setItem(`sprint-autosave-${data.code}`, plainToHtml(seed)); } catch { /* ignore */ }
        }
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

  const buildSprintPayload = () => {
    const apiMode = mode === "spectator" ? "open" : mode === "boss" ? "regular" : mode;
    const password = pwOn && pw.trim() ? pw.trim() : undefined;
    const dwpm = deathOn ? (parseInt(deathWpm, 10) || 15) : undefined;
    return {
      creatorName: displayName,
      durationMinutes: duration,
      mode: apiMode,
      ...(countdown > 0 ? { countdownDelayMinutes: countdown } : {}),
      ...(mode === "goal" ? { wordGoal: 1000 } : {}),
      ...(mode === "boss" ? { bossWordGoal: 5000 } : {}),
      ...(mode === "gladiator" ? { gladiatorDeathGap: 400 } : {}),
      ...(dwpm ? { deathModeWpm: dwpm } : {}),
      ...(password ? { roomPassword: password } : {}),
    };
  };

  const handleCreate = async () => {
    const payload = buildSprintPayload();

    if (isGuildFlow) {
      setGuildSubmitting(true);
      try {
        const r = await authedFetch(`${basePath}/api/guilds/${guildId}/sprint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          toast({
            title: "Failed to start guild sprint",
            description: (body as { error?: string }).error ?? "An unexpected error occurred",
            variant: "destructive",
          });
          return;
        }
        const code = (body as { roomCode?: string }).roomCode;
        if (code) {
          if (pwOn && pw.trim()) {
            try { sessionStorage.setItem(`room_password_${code}`, pw.trim()); } catch { /* ignore */ }
          }
          const seed = (chapterContent || "").trim();
          if (seed) {
            try { localStorage.setItem(`sprint-autosave-${code}`, plainToHtml(seed)); } catch { /* ignore */ }
          }
          onClose();
          setLocation(`/room?code=${code}&name=${encodeURIComponent(displayName)}&isCreator=true`);
        } else {
          onClose();
        }
      } finally {
        setGuildSubmitting(false);
      }
      return;
    }

    createRoomMutation.mutate({
      data: payload as Parameters<typeof createRoomMutation.mutate>[0]["data"],
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
    } catch { /* WS will surface errors */ }
    onClose();
    setLocation(`/room?code=${encodeURIComponent(code)}&name=${encodeURIComponent(displayName)}`);
  };

  if (!open) return null;

  return (
    <div className="sp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-card">
        <button className="sp-close" onClick={onClose} aria-label="Close">×</button>

        <div className="sp-badge">
          <span className="sp-badge-dot" /> SESSION OPEN
        </div>

        <h2 className="sp-title">{isGuildFlow ? "Start a guild sprint" : "Join the session"}</h2>
        <p className="sp-sub">
          {isGuildFlow ? <>Hosting as <strong>{displayName}</strong>. Members will be notified — they don't have to join.</> : <>Writing as <strong>{displayName}</strong></>}
        </p>

        {!isGuildFlow && (
          <div className="sp-tabs">
            <button className={`sp-tab${tab === "join" ? " active" : ""}`} onClick={() => setTab("join")}>Join Room</button>
            <button className={`sp-tab${tab === "create" ? " active" : ""}`} onClick={() => setTab("create")}>Create Room</button>
          </div>
        )}

        {tab === "join" ? (
          <div className="sp-section">
            <div className="sp-label">Room Code</div>
            <input
              className="sp-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABCDEF"
              maxLength={8}
            />
          </div>
        ) : (
          <>
            <div className="sp-section">
              <div className="sp-label">Sprint Duration</div>
              <div className="sp-chip-row sp-chip-row--3">
                {DURATIONS.map((m) => (
                  <button key={m} className={`sp-chip${duration === m ? " active" : ""}`} onClick={() => setDuration(m)}>{m} min</button>
                ))}
              </div>
            </div>

            <div className="sp-section">
              <div className="sp-label">
                <span className="sp-label-icon">⏱</span> Pre-Sprint Timer <span className="sp-label-hint">(auto-starts after)</span>
              </div>
              <div className="sp-chip-row sp-chip-row--4">
                {COUNTDOWNS.map((c) => (
                  <button key={c.value} className={`sp-chip${countdown === c.value ? " active" : ""}`} onClick={() => setCountdown(c.value)}>{c.label}</button>
                ))}
              </div>
            </div>

            <div className="sp-section">
              <div className="sp-label">Sprint Mode</div>
              <div className="sp-mode-grid">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    className={`sp-mode${mode === m.key ? " active" : ""}`}
                    onClick={() => setMode(m.key)}
                  >
                    <div className="sp-mode-icon">{m.icon}</div>
                    <div className="sp-mode-label">{m.label}</div>
                    <div className="sp-mode-desc">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-toggle-row">
              <div className="sp-toggle-label">
                <span className="sp-toggle-icon">💀</span>
                <span>Death Mode</span>
                <span className="sp-toggle-hint">(reaper line)</span>
              </div>
              <button
                className={`sp-switch${deathOn ? " on" : ""}`}
                onClick={() => setDeathOn((v) => !v)}
                aria-pressed={deathOn}
              ><span className="sp-switch-knob" /></button>
            </div>
            {deathOn && (
              <div className="sp-toggle-detail">
                <input
                  className="sp-input sp-input--small"
                  type="number"
                  min={1}
                  value={deathWpm}
                  onChange={(e) => setDeathWpm(e.target.value)}
                  placeholder="WPM"
                />
                <span className="sp-toggle-hint">words/min minimum</span>
              </div>
            )}

            <div className="sp-toggle-row">
              <div className="sp-toggle-label">
                <span className="sp-toggle-icon">🔒</span>
                <span>Room Password</span>
                <span className="sp-toggle-hint">(optional)</span>
              </div>
              <button
                className={`sp-switch${pwOn ? " on" : ""}`}
                onClick={() => setPwOn((v) => !v)}
                aria-pressed={pwOn}
              ><span className="sp-switch-knob" /></button>
            </div>
            {pwOn && (
              <div className="sp-toggle-detail">
                <input
                  className="sp-input sp-input--small"
                  type="text"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Set a password"
                />
              </div>
            )}
          </>
        )}

        <button
          className="sp-cta"
          onClick={tab === "join" ? handleJoin : handleCreate}
          disabled={createRoomMutation.isPending || guildSubmitting}
        >
          {tab === "join"
            ? "Enter Room"
            : (createRoomMutation.isPending || guildSubmitting)
              ? "Starting..."
              : isGuildFlow
                ? <>Start Guild Sprint <span className="sp-cta-spark">✦</span></>
                : <>Start New Session <span className="sp-cta-spark">✦</span></>}
        </button>
      </div>
    </div>
  );
}
