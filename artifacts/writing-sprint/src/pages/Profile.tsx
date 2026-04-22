import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pen, TrendingUp, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RANKS, getRankFromXp, getNextRank, xpProgressPercent } from "@/lib/ranks";

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

function RankBadge({ xp }: { xp: number }) {
  const rank = getRankFromXp(xp);
  const nextRank = getNextRank(rank);
  const progress = xpProgressPercent(xp, rank, nextRank);

  const borderColorMap: Record<number, string> = {
    0: "#71717a",
    1: "#94a3b8",
    2: "#f97316",
    3: "#8b5cf6",
    4: "#dc2626",
    5: "#facc15",
    6: "#22d3ee",
  };

  const glowMap: Record<number, string> = {
    0: "none",
    1: "0 0 10px rgba(148,163,184,0.3)",
    2: "0 0 15px rgba(249,115,22,0.5)",
    3: "0 0 15px rgba(139,92,246,0.5)",
    4: "0 0 20px rgba(220,38,38,0.6)",
    5: "0 0 25px rgba(250,204,21,0.7)",
    6: "0 0 30px rgba(34,211,238,0.8), 0 0 60px rgba(34,211,238,0.3)",
  };

  const bgMap: Record<number, string> = {
    0: "#1c1c20",
    1: "#1e2130",
    2: "#1c1008",
    3: "#1a1030",
    4: "#1c0808",
    5: "#201800",
    6: "#080c20",
  };

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
                ? `linear-gradient(90deg, ${borderColorMap[rank.index]}, ${rank.index === 6 ? "#6366f1" : "#f97316"})`
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

      {/* All ranks reference */}
      <div className="w-full max-w-xs">
        <div className="text-[10px] text-muted-foreground text-center mb-2 uppercase tracking-wider">Rank Progression</div>
        <div className="grid grid-cols-7 gap-1">
          {RANKS.map((r) => (
            <div
              key={r.index}
              className="flex flex-col items-center gap-0.5"
              title={`${r.title} (${r.minXp} XP)`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{
                  border: `2px solid ${r.index <= rank.index ? borderColorMap[r.index] : "#374151"}`,
                  background: r.index <= rank.index ? bgMap[r.index] : "transparent",
                  boxShadow: r.index === rank.index ? `0 0 8px ${borderColorMap[r.index]}` : "none",
                  opacity: r.index <= rank.index ? 1 : 0.3,
                }}
              >
                <span style={{ fontSize: "12px" }}>{r.emoji}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const [, params] = useRoute("/profile/:name");
  const [, setLocation] = useLocation();
  const name = decodeURIComponent(params?.name ?? "");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", name],
    queryFn: () => fetchProfile(name),
    enabled: !!name,
  });

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
          </>
        )}
      </div>
    </div>
  );
}
