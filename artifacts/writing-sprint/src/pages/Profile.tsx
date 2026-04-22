import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { ArrowLeft, Pen, TrendingUp, Hash, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RANKS, getRankFromXp, getNextRank, xpProgressPercent, type Rank } from "@/lib/ranks";
import { NAMEPLATES, getUnlockedNameplates, type NameplateKey } from "@/lib/nameplates";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  const res = await fetch(`${basePath}/api/user/profile`);
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
      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-semibold"
      style={{
        border: `1.5px solid ${c.border}`,
        background: c.bg,
        boxShadow: c.glow,
        color: c.text,
      }}
    >
      <span className="text-xl leading-none">{POSITION_SYMBOLS[position]}</span>
      <span className="font-mono font-black tracking-wide">{ordinal(position)}</span>
      <span className="text-xs font-medium opacity-75">Global Rank</span>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="flex-1">
      <CardContent className="pt-6 pb-5 px-5 flex flex-col items-center text-center gap-2">
        <div className="text-primary/70">{icon}</div>
        <div className="font-mono text-3xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</div>
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      </CardContent>
    </Card>
  );
}

const borderColorMap: Record<number, string> = {
  0: "#71717a",
  1: "#94a3b8",
  2: "#f97316",
  3: "#8b5cf6",
  4: "#dc2626",
  5: "#facc15",
  6: "#22d3ee",
  7: "#e879f9",
};

const glowMap: Record<number, string> = {
  0: "none",
  1: "0 0 10px rgba(148,163,184,0.3)",
  2: "0 0 15px rgba(249,115,22,0.5)",
  3: "0 0 15px rgba(139,92,246,0.5)",
  4: "0 0 20px rgba(220,38,38,0.6)",
  5: "0 0 25px rgba(250,204,21,0.7)",
  6: "0 0 30px rgba(34,211,238,0.8), 0 0 60px rgba(34,211,238,0.3)",
  7: "0 0 35px rgba(232,121,249,0.9), 0 0 70px rgba(232,121,249,0.35)",
};

const bgMap: Record<number, string> = {
  0: "#1c1c20",
  1: "#1e2130",
  2: "#1c1008",
  3: "#1a1030",
  4: "#1c0808",
  5: "#201800",
  6: "#080c20",
  7: "#1a0020",
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
            style={{
              border: `4px solid ${color}`,
              boxShadow: glowMap[rank.index],
              background: bgMap[rank.index],
            }}
          >
            <span className="text-4xl">{rank.emoji}</span>
          </div>

          <div className="space-y-1">
            <div
              className="text-base font-black uppercase tracking-wider"
              style={{ color, textShadow: rank.index >= 4 ? `0 0 10px ${color}` : "none" }}
            >
              {rank.title}
            </div>
            <div className="text-xs text-muted-foreground italic">{rank.subtitle}</div>
          </div>

          <div
            className="text-xs font-mono font-semibold px-3 py-1.5 rounded-full"
            style={{ background: bgMap[rank.index], color, border: `1px solid ${color}40` }}
          >
            {xpRangeText}
          </div>

          {rank.index === 0 && (
            <p className="text-xs text-muted-foreground">The starting rank — every writer begins here.</p>
          )}
          {rank.index === 6 && (
            <p className="text-xs text-muted-foreground">The highest rank. Very few reach this level.</p>
          )}
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
    <div className="flex flex-col items-center gap-4">
      {/* Avatar with rank border */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center relative"
        style={{
          border: `4px solid ${borderColorMap[rank.index]}`,
          boxShadow: glowMap[rank.index],
          background: bgMap[rank.index],
        }}
      >
        {rank.index === 6 ? (
          <div className="relative">
            <span className="text-4xl">{rank.emoji}</span>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)",
                animation: "pulse 2s infinite",
              }}
            />
          </div>
        ) : (
          <span className="text-4xl">{rank.emoji}</span>
        )}

        {/* Rank index badge */}
        <div
          className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
          style={{ background: borderColorMap[rank.index], boxShadow: `0 0 6px ${borderColorMap[rank.index]}` }}
        >
          {rank.index + 1}
        </div>
      </div>

      {/* Rank title */}
      <div className="text-center space-y-1">
        <div
          className="text-base font-black uppercase tracking-wider"
          style={{ color: borderColorMap[rank.index], textShadow: rank.index >= 4 ? `0 0 10px ${borderColorMap[rank.index]}` : "none" }}
        >
          {rank.emoji} {rank.title}
        </div>
        <div className="text-xs text-muted-foreground italic">{rank.subtitle}</div>
      </div>

      {/* XP progress bar */}
      <div className="w-full max-w-xs space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="font-mono font-semibold" style={{ color: borderColorMap[rank.index] }}>
            {xp.toLocaleString()} XP
          </span>
          {nextRank ? (
            <span className="text-muted-foreground">
              Next: {nextRank.emoji} {nextRank.title}
            </span>
          ) : (
            <span className="text-muted-foreground font-semibold">Max rank</span>
          )}
        </div>

        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: rank.index >= 5
                ? `linear-gradient(90deg, ${borderColorMap[rank.index]}, ${rank.index === 7 ? "#ec4899" : rank.index === 6 ? "#6366f1" : "#f97316"})`
                : borderColorMap[rank.index],
              boxShadow: rank.index >= 3 ? `0 0 6px ${borderColorMap[rank.index]}` : "none",
            }}
          />
        </div>

        {nextRank && (
          <div className="text-[10px] text-muted-foreground text-center">
            {(nextRank.minXp - xp).toLocaleString()} XP to next rank
          </div>
        )}
      </div>

      {/* All ranks reference — click each to see details */}
      <div className="w-full max-w-xs">
        <div className="text-[10px] text-muted-foreground text-center mb-2 uppercase tracking-wider">Rank Progression — click to explore</div>
        <div className="grid grid-cols-8 gap-1">
          {RANKS.map((r) => (
            <button
              key={r.index}
              className="flex flex-col items-center gap-0.5 group"
              onClick={() => setSelectedRank(r)}
              title={`${r.title} (${r.minXp.toLocaleString()} XP)`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-transform group-hover:scale-110 group-hover:opacity-100"
                style={{
                  border: `2px solid ${r.index <= rank.index ? borderColorMap[r.index] : "#374151"}`,
                  background: r.index <= rank.index ? bgMap[r.index] : "transparent",
                  boxShadow: r.index === rank.index ? `0 0 8px ${borderColorMap[r.index]}` : "none",
                  opacity: r.index <= rank.index ? 1 : 0.3,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "12px" }}>{r.emoji}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <RankDetailDialog
        rank={selectedRank}
        open={selectedRank !== null}
        onClose={() => setSelectedRank(null)}
      />
    </div>
  );
}

export default function Profile() {
  const [, params] = useRoute("/profile/:name");
  const [, setLocation] = useLocation();
  const name = decodeURIComponent(params?.name ?? "");
  const { user } = useUser();
  const queryClient = useQueryClient();

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

  const isOwnProfile = !!user && (
    ownPrefs?.writerName?.toLowerCase() === name.toLowerCase() ||
    (user.username?.toLowerCase() === name.toLowerCase()) ||
    (user.fullName?.toLowerCase() === name.toLowerCase()) ||
    ((user.publicMetadata?.writerName as string | undefined)?.toLowerCase() === name.toLowerCase())
  );

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
    onError: (_err, _nameplate, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["own-prefs"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["own-prefs"] });
    },
  });

  const globalRankEntry = top10?.find(
    (e) => e.writerName.toLowerCase() === name.toLowerCase(),
  );

  if (!name) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No name provided.</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg space-y-8">

        <Button variant="ghost" size="sm" onClick={() => history.back()} className="gap-2 text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        {isLoading && (
          <div className="text-center text-muted-foreground py-16">Loading profile…</div>
        )}

        {isError && (
          <div className="text-center text-destructive py-16">Couldn't load this profile.</div>
        )}

        {data && (
          <>
            <div className="text-center space-y-3">
              <h1 className="text-3xl font-serif font-bold text-foreground">{data.writerName}</h1>
              {globalRankEntry && (
                <div className="flex justify-center">
                  <GlobalRankBadge position={globalRankEntry.position} />
                </div>
              )}
              {data.sprintCount === 0 && (
                <p className="text-muted-foreground text-sm mt-1">No sprints recorded yet.</p>
              )}
            </div>

            {/* Rank badge */}
            <div className="flex justify-center">
              <RankBadge xp={data.xp} />
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <StatCard
                icon={<Pen className="w-5 h-5" />}
                label="All-time words"
                value={data.totalWords}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Best sprint"
                value={data.highestWordCount}
              />
              <StatCard
                icon={<Hash className="w-5 h-5" />}
                label="Sprints"
                value={data.sprintCount}
              />
            </div>

            {data.sprintCount > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Averaging <span className="font-semibold text-foreground">
                  {Math.round(data.totalWords / data.sprintCount).toLocaleString()}
                </span> words per sprint
              </p>
            )}

            {/* Nameplate Picker — only visible on own profile */}
            {isOwnProfile && data.xp >= 10000 && (
              <Card>
                <CardContent className="pt-5 pb-5 px-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your Nameplate</p>
                  <div className="flex flex-wrap gap-2">
                    {getUnlockedNameplates(data.xp).map((np) => {
                      const isActive = (ownPrefs?.nameplate ?? "default") === np.key;
                      return (
                        <button
                          key={np.key}
                          onClick={() => nameplateMutation.mutate(np.key)}
                          title={np.description}

                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 ${
                            isActive
                              ? "border-current opacity-100 ring-2 ring-offset-1 ring-offset-card"
                              : "border-border opacity-60 hover:opacity-90"
                          }`}
                          style={
                            np.key !== "default"
                              ? { color: NAMEPLATES[np.key as NameplateKey]?.color, borderColor: isActive ? NAMEPLATES[np.key as NameplateKey]?.color : undefined, outlineColor: isActive ? NAMEPLATES[np.key as NameplateKey]?.color : undefined }
                              : {}
                          }
                        >
                          {isActive && <Check className="w-3 h-3" />}
                          {np.label}
                        </button>
                      );
                    })}
                  </div>
                  {data.xp < 25000 && (
                    <p className="text-[11px] text-muted-foreground mt-2">More nameplates unlock at higher ranks.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
