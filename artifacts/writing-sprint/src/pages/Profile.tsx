import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RANKS, getRankFromXp, getNextRank, xpProgressPercent, type Rank } from "@/lib/ranks";
import { NAMEPLATES, getUnlockedNameplates, type NameplateKey } from "@/lib/nameplates";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 18,
  boxShadow: "0 4px 24px rgba(107,143,212,0.09)",
};

interface PublicProfile {
  name: string;
  writerName: string;
  xp: number;
  totalWords: number;
  highestWordCount: number;
  sprintCount: number;
}

async function fetchProfile(name: string): Promise<PublicProfile> {
  const res = await fetch(`${basePath}/api/users/by-name/${encodeURIComponent(name)}/profile`);
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

async function fetchOwnPrefs(): Promise<{ nameplate: string; skin: string; writerName: string }> {
  const res = await fetch(`${basePath}/api/user/profile`, { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  const data = await res.json();
  return { nameplate: data.activeNameplate ?? "default", skin: data.activeSkin ?? "default", writerName: data.writerName ?? "" };
}

async function saveNameplate(nameplate: string): Promise<void> {
  const res = await fetch(`${basePath}/api/user/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ activeNameplate: nameplate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to save");
  }
}

async function fetchDiscordSettings(): Promise<{ webhookUrl: string | null }> {
  const res = await fetch(`${basePath}/api/user/discord`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load Discord settings");
  return res.json();
}

async function saveDiscordWebhook(webhookUrl: string | null): Promise<void> {
  const res = await fetch(`${basePath}/api/user/discord`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ webhookUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to save");
  }
}

async function testDiscordWebhook(): Promise<void> {
  const res = await fetch(`${basePath}/api/user/discord/test`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Test failed");
  }
}

async function fetchBagCount(): Promise<number> {
  const res = await fetch(`${basePath}/api/user/bag`, { credentials: "include" });
  if (!res.ok) return 0;
  const data = await res.json();
  return (data.inventory as unknown[])?.length ?? 0;
}

async function fetchChestCount(): Promise<number> {
  const res = await fetch(`${basePath}/api/user/chests`, { credentials: "include" });
  if (!res.ok) return 0;
  const data = await res.json() as Record<string, number>;
  return ["mortal", "iron", "crystal", "inferno", "immortal"].reduce((s, k) => s + (data[k] ?? 0), 0);
}

async function fetchRecipeCount(): Promise<number> {
  const res = await fetch(`${basePath}/api/user/crafting/all-recipes`, { credentials: "include" });
  if (!res.ok) return 0;
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

interface Top10Entry { writerName: string; xp: number; position: number; }

async function fetchTop10(): Promise<Top10Entry[]> {
  const res = await fetch(`${basePath}/api/rankings/top10`);
  if (!res.ok) return [];
  return res.json();
}

const POSITION_SYMBOLS: Record<number, string> = {
  1: "🥇", 2: "🥈", 3: "🥉",
  4: "👑", 5: "👑", 6: "👑", 7: "👑", 8: "👑", 9: "👑", 10: "👑",
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function GlobalRankBadge({ position }: { position: number }) {
  const isMedal = position <= 3;
  const medalColors: Record<number, { border: string; glow: string; bg: string; text: string }> = {
    1: { border: "#fbbf24", glow: "0 0 18px #fbbf2466", bg: "rgba(251,191,36,0.08)", text: "#fbbf24" },
    2: { border: "#94a3b8", glow: "0 0 14px #94a3b844", bg: "rgba(148,163,184,0.08)", text: "#94a3b8" },
    3: { border: "#cd7c45", glow: "0 0 14px #cd7c4544", bg: "rgba(205,124,69,0.08)", text: "#cd7c45" },
  };
  const rankerColor = { border: "#e879f9", glow: "0 0 14px #e879f944", bg: "rgba(232,121,249,0.08)", text: "#e879f9" };
  const c = isMedal ? medalColors[position] : rankerColor;

  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "6px 16px", borderRadius: 999,
        border: `1.5px solid ${c.border}`,
        background: c.bg,
        boxShadow: c.glow,
        color: c.text,
        fontSize: "0.85rem", fontWeight: 700,
      }}
    >
      <span style={{ fontSize: "1rem" }}>{POSITION_SYMBOLS[position]}</span>
      <span style={{ fontWeight: 900, letterSpacing: "0.04em" }}>{ordinal(position)}</span>
      <span style={{ fontSize: "0.75rem", fontWeight: 500, opacity: 0.75 }}>Global Rank</span>
    </div>
  );
}

const borderColorMap: Record<number, string> = {
  0: "#71717a", 1: "#94a3b8", 2: "#f97316", 3: "#8b5cf6",
  4: "#dc2626", 5: "#facc15", 6: "#22d3ee", 7: "#e879f9",
};

const glowMap: Record<number, string> = {
  0: "none", 1: "0 0 10px rgba(148,163,184,0.3)", 2: "0 0 15px rgba(249,115,22,0.5)",
  3: "0 0 15px rgba(139,92,246,0.5)", 4: "0 0 20px rgba(220,38,38,0.6)",
  5: "0 0 25px rgba(250,204,21,0.7)", 6: "0 0 30px rgba(34,211,238,0.8), 0 0 60px rgba(34,211,238,0.3)",
  7: "0 0 35px rgba(232,121,249,0.9), 0 0 70px rgba(232,121,249,0.35)",
};

const bgMap: Record<number, string> = {
  0: "#1c1c20", 1: "#1e2130", 2: "#1c1008", 3: "#1a1030",
  4: "#1c0808", 5: "#201800", 6: "#080c20", 7: "#1a0020",
};

function RankDetailDialog({ rank, open, onClose }: { rank: Rank | null; open: boolean; onClose: () => void }) {
  if (!rank) return null;
  const nextRank = getNextRank(rank);
  const color = borderColorMap[rank.index];
  const xpRangeText = nextRank
    ? `${rank.minXp.toLocaleString()} – ${(nextRank.minXp - 1).toLocaleString()} XP`
    : `${rank.minXp.toLocaleString()}+ XP`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader>
          <DialogTitle className="sr-only">{rank.title}</DialogTitle>
          <DialogDescription className="sr-only">{rank.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ border: `4px solid ${color}`, boxShadow: glowMap[rank.index], background: bgMap[rank.index] }}
          >
            <span className="text-4xl">{rank.emoji}</span>
          </div>
          <div className="space-y-1">
            <div className="text-base font-black uppercase tracking-wider" style={{ color, textShadow: rank.index >= 4 ? `0 0 10px ${color}` : "none" }}>
              {rank.title}
            </div>
            <div className="text-xs text-muted-foreground italic">{rank.subtitle}</div>
          </div>
          <div className="text-xs font-mono font-semibold px-3 py-1.5 rounded-full" style={{ background: bgMap[rank.index], color, border: `1px solid ${color}40` }}>
            {xpRangeText}
          </div>
          {rank.index === 0 && <p className="text-xs text-muted-foreground">The starting rank — every writer begins here.</p>}
          {rank.index === 6 && <p className="text-xs text-muted-foreground">The highest rank. Very few reach this level.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RankBadge({ xp }: { xp: number }) {
  const rank = getRankFromXp(xp);
  const nextRank = getNextRank(rank);
  const progress = xpProgressPercent(xp, rank, nextRank);
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 96, height: 96, borderRadius: "50%",
          border: `4px solid ${borderColorMap[rank.index]}`,
          boxShadow: glowMap[rank.index],
          background: bgMap[rank.index],
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}
      >
        <span style={{ fontSize: "2.4rem" }}>{rank.emoji}</span>
        <div
          style={{
            position: "absolute", bottom: -4, right: -4,
            width: 22, height: 22, borderRadius: "50%",
            background: borderColorMap[rank.index],
            boxShadow: `0 0 6px ${borderColorMap[rank.index]}`,
            color: "white", fontSize: "0.72rem", fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #F5F2EC",
          }}
        >
          {rank.index + 1}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 900, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#e879a0" }}>
          <span style={{ marginRight: 4 }}>{rank.emoji}</span>{rank.title}
        </div>
        <div style={{ fontSize: "0.82rem", color: "#7a7a92", fontStyle: "italic", marginTop: 4 }}>{rank.subtitle}</div>
      </div>

      <div style={{ width: "100%", maxWidth: 280 }}>
        {!nextRank ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: "0.85rem" }}>
              <span style={{ fontWeight: 600, color: "#e879a0" }}>{xp.toLocaleString()} XP</span>
              <span style={{ color: "#7a7a92", display: "flex", alignItems: "center", gap: 4 }}><span>👑</span> Ranking XP</span>
            </div>
            <div style={{ height: 7, background: "rgba(107,143,212,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${Math.min(100, Math.floor(((xp - 200000) / 100000) * 100))}%`,
                background: "linear-gradient(90deg, #6B8FD4, #e879a0)",
              }} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "#7a7a92", textAlign: "center", marginTop: 6 }}>
              XP above 200k counts toward your global rank position
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: "0.85rem" }}>
              <span style={{ fontWeight: 600, color: borderColorMap[rank.index] }}>{xp.toLocaleString()} XP</span>
              <span style={{ color: "#7a7a92" }}>Next: {nextRank.emoji} {nextRank.title}</span>
            </div>
            <div style={{ height: 7, background: "rgba(107,143,212,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${progress}%`,
                background: rank.index >= 5
                  ? `linear-gradient(90deg, ${borderColorMap[rank.index]}, ${rank.index === 6 ? "#6366f1" : "#f97316"})`
                  : `linear-gradient(90deg, #6B8FD4, #e879a0)`,
                boxShadow: rank.index >= 3 ? `0 0 6px ${borderColorMap[rank.index]}` : "none",
              }} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "#7a7a92", textAlign: "center", marginTop: 6 }}>
              {(nextRank.minXp - xp).toLocaleString()} XP to next rank
            </div>
          </>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 280 }}>
        <div style={{ fontSize: "0.72rem", color: "#7a7a92", textAlign: "center", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
          Rank Progression — click to explore
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {RANKS.map((r) => (
            <button
              key={r.index}
              onClick={() => setSelectedRank(r)}
              title={`${r.title} (${r.minXp.toLocaleString()} XP)`}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: r.index <= rank.index ? bgMap[r.index] : "rgba(0,0,0,0.06)",
                border: `2px solid ${r.index <= rank.index ? borderColorMap[r.index] : "rgba(107,143,212,0.15)"}`,
                boxShadow: r.index === rank.index ? `0 0 16px ${borderColorMap[r.index]}80` : "0 3px 12px rgba(0,0,0,0.1)",
                opacity: r.index <= rank.index ? 1 : 0.4,
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem",
              }}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      </div>

      <RankDetailDialog rank={selectedRank} open={selectedRank !== null} onClose={() => setSelectedRank(null)} />
    </div>
  );
}

export default function Profile() {
  const [, params] = useRoute("/profile/:name");
  const [, setLocation] = useLocation();
  const name = decodeURIComponent(params?.name ?? "");
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [webhookInput, setWebhookInput] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", name],
    queryFn: () => fetchProfile(name),
    enabled: !!name,
  });

  const { data: top10 } = useQuery({
    queryKey: ["top10"],
    queryFn: fetchTop10,
    staleTime: 5 * 60 * 1000,
  });

  const { data: ownPrefs } = useQuery({
    queryKey: ["own-prefs"],
    queryFn: fetchOwnPrefs,
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: discordSettings } = useQuery({
    queryKey: ["discord-settings"],
    queryFn: fetchDiscordSettings,
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (discordSettings?.webhookUrl != null) {
      setWebhookInput(discordSettings.webhookUrl);
    }
  }, [discordSettings?.webhookUrl]);

  const saveWebhookMutation = useMutation({
    mutationFn: (url: string | null) => saveDiscordWebhook(url),
    onSuccess: (_data, url) => {
      queryClient.setQueryData(["discord-settings"], { webhookUrl: url || null });
      toast({
        title: url ? "Discord webhook saved" : "Discord webhook removed",
        description: url
          ? "Sprints you create will be announced in your Discord channel."
          : "Discord integration disconnected.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save webhook", description: err.message, variant: "destructive" });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: testDiscordWebhook,
    onSuccess: () => {
      toast({ title: "Test message sent!", description: "Check your Discord channel." });
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const isOwnProfile = !!user && (
    ownPrefs?.writerName?.toLowerCase() === name.toLowerCase() ||
    (user.username?.toLowerCase() === name.toLowerCase()) ||
    (user.fullName?.toLowerCase() === name.toLowerCase()) ||
    ((user.publicMetadata?.writerName as string | undefined)?.toLowerCase() === name.toLowerCase())
  );

  const { data: bagCount = 0 } = useQuery({
    queryKey: ["profile-bag-count"],
    queryFn: fetchBagCount,
    enabled: isOwnProfile,
    staleTime: 60_000,
  });

  const { data: chestCount = 0 } = useQuery({
    queryKey: ["profile-chest-count"],
    queryFn: fetchChestCount,
    enabled: isOwnProfile,
    staleTime: 60_000,
  });

  const { data: recipeCount = 0 } = useQuery({
    queryKey: ["profile-recipe-count"],
    queryFn: fetchRecipeCount,
    enabled: isOwnProfile,
    staleTime: 60_000,
  });

  const nameplateMutation = useMutation({
    mutationFn: saveNameplate,
    onMutate: async (nameplate) => {
      await queryClient.cancelQueries({ queryKey: ["own-prefs"] });
      const previous = queryClient.getQueryData<{ nameplate: string; skin: string; writerName: string }>(["own-prefs"]);
      queryClient.setQueryData(["own-prefs"], (old: { nameplate: string; skin: string; writerName: string } | undefined) =>
        old ? { ...old, nameplate } : { nameplate, skin: "default", writerName: name }
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Nameplate updated!" });
    },
    onError: (err: Error, _nameplate, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["own-prefs"], context.previous);
      }
      toast({ title: "Couldn't save nameplate", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["own-prefs"] });
    },
  });

  const globalRankEntry = top10?.find(
    (e) => e.writerName.toLowerCase() === name.toLowerCase(),
  );

  if (!name) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F2EC", color: "#7a7a92" }}>No name provided.</div>;
  }

  return (
    <>
      {/* Fixed background layers */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(107,143,212,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(107,143,212,0.05) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,143,212,0.15) 0%, transparent 70%)", filter: "blur(90px)", top: -120, right: -100, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,168,56,0.09) 0%, transparent 70%)", filter: "blur(90px)", bottom: 0, left: -80, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)", filter: "blur(90px)", top: "40%", left: "30%", pointerEvents: "none", zIndex: 0 }} />

      {/* Scrollable content */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", background: "#F5F2EC", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, paddingBottom: 60, paddingLeft: 20, paddingRight: 20 }}>
        <div style={{ width: "100%", maxWidth: 520, animation: "portalFadeUp 0.6s cubic-bezier(.22,1,.36,1) both" }}>

          {/* Back button */}
          <button
            onClick={() => setLocation("/portal")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#7a7a92", fontSize: "0.85rem", fontWeight: 500, marginBottom: 24, padding: "4px 0", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1a1a2e")}
            onMouseLeave={e => (e.currentTarget.style.color = "#7a7a92")}
          >
            <ArrowLeft size={15} /> Back
          </button>

          {isLoading && (
            <div style={{ textAlign: "center", color: "#7a7a92", padding: "64px 0" }}>Loading profile…</div>
          )}

          {isError && (
            <div style={{ textAlign: "center", color: "#dc2626", padding: "64px 0" }}>Couldn't load this profile.</div>
          )}

          {data && (
            <>
              {/* Profile name */}
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "2.4rem", fontWeight: 900,
                color: "#1a1a2e", textAlign: "center",
                letterSpacing: "-0.02em", marginBottom: 10,
              }}>
                {data.writerName}
              </h1>

              {/* Global rank badge */}
              {globalRankEntry && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
                  <GlobalRankBadge position={globalRankEntry.position} />
                </div>
              )}

              {/* No sprints note */}
              {data.sprintCount === 0 && (
                <p style={{ textAlign: "center", color: "#7a7a92", fontSize: "0.88rem", marginBottom: 16 }}>No sprints recorded yet.</p>
              )}

              {/* Avatar + rank */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <RankBadge xp={data.xp} />
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                {[
                  { emoji: "✍️", label: "All-Time Words", value: data.totalWords },
                  { emoji: "🏆", label: "Best Sprint", value: data.highestWordCount },
                  { emoji: "#", label: "Sprints", value: data.sprintCount },
                ].map(({ emoji, label, value }) => (
                  <div key={label} style={{ ...CARD, padding: "18px 10px", textAlign: "center", transition: "transform 0.2s" }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.transform = "")}
                  >
                    <div style={{ fontSize: "1.1rem", marginBottom: 6, color: "#6B8FD4" }}>{emoji}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#1a1a2e", lineHeight: 1, marginBottom: 5 }}>
                      {typeof value === "number" ? value.toLocaleString() : value}
                    </div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", color: "#7a7a92", textTransform: "uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>

              {data.sprintCount > 0 && (
                <p style={{ textAlign: "center", fontSize: "0.88rem", color: "#7a7a92", marginBottom: 24 }}>
                  Averaging <strong style={{ color: "#1a1a2e" }}>{Math.round(data.totalWords / data.sprintCount).toLocaleString()} words</strong> per sprint
                </p>
              )}

              {/* Cultivation — only visible on own profile */}
              {isOwnProfile && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#7a7a92", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
                    Cultivation
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      { emoji: "🎒", label: "Bag", description: "Items, effects & inventory", statLabel: "items", statValue: bagCount, href: "/bag" },
                      { emoji: "🎁", label: "Chests", description: "Open rewards from sprinting", statLabel: "to open", statValue: chestCount, href: "/chests" },
                      { emoji: "⚗️", label: "Crafting", description: "Fusion, alchemy & tribulation", statLabel: "recipes", statValue: recipeCount, href: "/crafting" },
                    ].map(({ emoji, label, description, statLabel, statValue, href }) => (
                      <button
                        key={href}
                        onClick={() => setLocation(href)}
                        style={{ ...CARD, padding: "16px 12px", cursor: "pointer", textAlign: "left", border: "1px solid rgba(255,255,255,0.9)", transition: "all 0.2s", display: "flex", flexDirection: "column" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(107,143,212,0.15)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(107,143,212,0.08)"; }}
                      >
                        <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>{emoji}</div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: "0.75rem", color: "#7a7a92", lineHeight: 1.4, marginBottom: 10 }}>{description}</div>
                        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid rgba(107,143,212,0.15)", fontSize: "0.72rem", color: "#7a7a92" }}>
                          <span>{statLabel}</span>
                          <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{statValue}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nameplate Picker — only visible on own profile */}
              {isOwnProfile && data.xp >= 10000 && (
                <div style={{ ...CARD, padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#7a7a92", textTransform: "uppercase", marginBottom: 14 }}>
                    Your Nameplate
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {getUnlockedNameplates(data.xp).map((np) => {
                      const isActive = (ownPrefs?.nameplate ?? "default") === np.key;
                      const npColor = np.key !== "default" ? NAMEPLATES[np.key as NameplateKey]?.color : undefined;
                      return (
                        <button
                          key={np.key}
                          onClick={() => nameplateMutation.mutate(np.key)}
                          title={np.description}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "6px 16px", borderRadius: 999,
                            fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${isActive ? (npColor ?? "#1a1a2e") : "rgba(107,143,212,0.2)"}`,
                            background: isActive ? (npColor ? `${npColor}15` : "rgba(26,26,46,0.08)") : "white",
                            color: isActive ? (npColor ?? "#1a1a2e") : "#7a7a92",
                            transition: "all 0.18s",
                            outline: isActive ? `2px solid ${npColor ?? "#1a1a2e"}40` : "none",
                            outlineOffset: 2,
                          }}
                        >
                          {isActive && <Check size={11} />}
                          {np.label}
                        </button>
                      );
                    })}
                  </div>
                  {data.xp < 25000 && (
                    <p style={{ fontSize: "0.72rem", color: "#7a7a92", marginTop: 8 }}>More nameplates unlock at higher ranks.</p>
                  )}
                </div>
              )}

              {/* Discord Integration — only visible on own profile */}
              {isOwnProfile && (
                <div style={{ ...CARD, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: "#5865F2", flexShrink: 0 }} aria-hidden="true">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                      </svg>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#7a7a92", textTransform: "uppercase" }}>Discord Integration</span>
                    </div>
                    {discordSettings?.webhookUrl && (
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", color: "#16a34a" }}>
                        Connected
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: "0.83rem", color: "#7a7a92", lineHeight: 1.5, marginBottom: 10 }}>
                    Paste a Discord channel webhook URL below. When you start a sprint from the web app, an announcement will automatically be posted to that channel.
                  </p>

                  <a
                    href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.83rem", color: "#6B8FD4", textDecoration: "none", marginBottom: 14 }}
                  >
                    How to create a webhook in Discord <ExternalLink size={12} />
                  </a>

                  <div style={{ display: "flex", gap: 8, marginBottom: discordSettings?.webhookUrl ? 10 : 0 }}>
                    <input
                      type="text"
                      placeholder="https://discord.com/api/webhooks/…"
                      value={webhookInput}
                      onChange={(e) => setWebhookInput(e.target.value)}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.7)",
                        border: "1.5px solid rgba(107,143,212,0.2)", borderRadius: 11,
                        padding: "10px 14px", fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.83rem", color: "#1a1a2e", outline: "none",
                        transition: "all 0.2s",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#6B8FD4"; e.target.style.background = "white"; e.target.style.boxShadow = "0 0 0 3px rgba(107,143,212,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(107,143,212,0.2)"; e.target.style.background = "rgba(255,255,255,0.7)"; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      style={{
                        background: "linear-gradient(135deg, #7fa4e0, #5a82d0)",
                        border: "none", borderRadius: 11, padding: "10px 18px",
                        color: "white", fontFamily: "'DM Sans', sans-serif",
                        fontSize: "0.88rem", fontWeight: 700, cursor: saveWebhookMutation.isPending ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 16px rgba(90,130,208,0.3)",
                        transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        opacity: saveWebhookMutation.isPending ? 0.7 : 1,
                      }}
                      disabled={saveWebhookMutation.isPending}
                      onClick={() => saveWebhookMutation.mutate(webhookInput.trim() || null)}
                    >
                      {saveWebhookMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                    </button>
                  </div>

                  {discordSettings?.webhookUrl && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        disabled={testWebhookMutation.isPending}
                        onClick={() => testWebhookMutation.mutate()}
                        style={{
                          background: "white", border: "1.5px solid rgba(107,143,212,0.2)", borderRadius: 9,
                          padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, color: "#1a1a2e",
                          cursor: testWebhookMutation.isPending ? "not-allowed" : "pointer",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          transition: "all 0.18s",
                        }}
                      >
                        {testWebhookMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                        Send test message
                      </button>
                      <button
                        disabled={saveWebhookMutation.isPending}
                        onClick={() => { setWebhookInput(""); saveWebhookMutation.mutate(null); }}
                        style={{
                          background: "none", border: "1.5px solid rgba(220,38,38,0.2)", borderRadius: 9,
                          padding: "7px 14px", fontSize: "0.82rem", fontWeight: 600, color: "#dc2626",
                          cursor: saveWebhookMutation.isPending ? "not-allowed" : "pointer",
                          transition: "all 0.18s",
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
