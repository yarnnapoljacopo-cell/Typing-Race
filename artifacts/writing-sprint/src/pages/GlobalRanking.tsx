import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Crown, ArrowLeft, Trophy, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const RANKER_MIN_XP = 200000;

interface RankerEntry {
  writerName: string;
  xp: number;
}

async function fetchProfile(): Promise<{ writerName: string | null; xp: number }> {
  const res = await fetch(`${basePath}/api/user/profile`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

async function fetchGlobalRankings(): Promise<RankerEntry[]> {
  const res = await fetch(`${basePath}/api/rankings/global`);
  if (!res.ok) throw new Error("Failed to load rankings");
  return res.json();
}

function XpBar({ xp }: { xp: number }) {
  const aboveRanker = xp - RANKER_MIN_XP;
  const span = 100_000; // visual span: 200k–300k
  const progress = Math.min(100, Math.floor((aboveRanker / span) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-fuchsia-900/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-mono text-fuchsia-300 whitespace-nowrap">
        {xp.toLocaleString()} XP
      </span>
    </div>
  );
}

export default function GlobalRanking() {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchProfile,
    enabled: isLoaded && !!isSignedIn,
  });

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ["global-rankings"],
    queryFn: fetchGlobalRankings,
  });

  if (!isLoaded || profileLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const myXp = profile?.xp ?? 0;
  const myName = profile?.writerName;
  const isRanker = myXp >= RANKER_MIN_XP;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div
        className="border-b"
        style={{
          background: "linear-gradient(135deg, #1a0020 0%, #2d0039 50%, #1a0020 100%)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <button
            onClick={() => setLocation("/portal")}
            className="text-fuchsia-300/60 hover:text-fuchsia-300 transition-colors mr-1"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #e879f9, #ec4899)" }}
          >
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Global Ranking</h1>
            <p className="text-xs text-fuchsia-300/70">The Rankers — hall of legends</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

        {/* Non-ranker teaser */}
        {!isRanker && isSignedIn && (
          <div
            className="rounded-xl px-4 py-3 mb-5 text-sm text-fuchsia-200/80"
            style={{
              background: "rgba(232,121,249,0.07)",
              border: "1px solid rgba(232,121,249,0.2)",
            }}
          >
            You need <strong className="text-fuchsia-300">200,000 XP</strong> to earn a spot here.
            Keep writing — you're at <strong className="text-fuchsia-300">{myXp.toLocaleString()} XP</strong>.
          </div>
        )}

        {rankingsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
          </div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Trophy className="w-10 h-10 text-fuchsia-400/40" />
            <p className="text-sm text-muted-foreground">
              No Rankers yet. The hall awaits the first legend.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {rankings.map((entry, idx) => {
              const isMe = entry.writerName === myName;
              const medal =
                idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;

              return (
                <li
                  key={entry.writerName}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
                  style={{
                    background: isMe
                      ? "linear-gradient(135deg, rgba(232,121,249,0.12), rgba(236,72,153,0.08))"
                      : idx < 3
                      ? "rgba(232,121,249,0.04)"
                      : "rgba(255,255,255,0.02)",
                    border: isMe
                      ? "1px solid rgba(232,121,249,0.35)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Position */}
                  <div className="w-8 text-center shrink-0">
                    {medal ? (
                      <span className="text-lg leading-none">{medal}</span>
                    ) : (
                      <span className="text-sm font-mono text-muted-foreground">
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Crown badge */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(232,121,249,0.25), rgba(236,72,153,0.15))",
                      border: "1px solid rgba(232,121,249,0.4)",
                    }}
                  >
                    👑
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-semibold truncate block"
                      style={{ color: isMe ? "#e879f9" : "rgba(255,255,255,0.85)" }}
                    >
                      {entry.writerName}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-normal text-fuchsia-400/70">
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-fuchsia-300/50">The Ranker</span>
                  </div>

                  {/* XP bar */}
                  <XpBar xp={entry.xp} />
                </li>
              );
            })}
          </ol>
        )}

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground/40 mt-8">
          Only writers who have reached 200,000 XP appear here.
        </p>
      </div>
    </div>
  );
}
