import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Crown, ArrowLeft, Trophy, Loader2, Lock } from "lucide-react";

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

  const myXp = profile?.xp ?? 0;
  const myName = profile?.writerName;
  const isRanker = myXp >= RANKER_MIN_XP;

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ["global-rankings"],
    queryFn: fetchGlobalRankings,
    enabled: isRanker,
  });

  if (!isLoaded || profileLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

        {/* Access Restricted — non-rankers */}
        {!isRanker ? (
          <div className="flex flex-col items-center gap-6 py-16 text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(232,121,249,0.08)", border: "1px solid rgba(232,121,249,0.2)" }}
            >
              <Lock className="w-9 h-9 text-fuchsia-400/60" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white/90 mb-1">Access Restricted</h2>
              <p className="text-sm text-fuchsia-300/60 max-w-xs leading-relaxed">
                Only writers who have reached{" "}
                <strong className="text-fuchsia-300">200,000 XP</strong> can view the Global Ranking.
              </p>
            </div>
            {isSignedIn && (
              <div
                className="rounded-xl px-5 py-4 text-sm text-fuchsia-200/80 max-w-xs"
                style={{
                  background: "rgba(232,121,249,0.07)",
                  border: "1px solid rgba(232,121,249,0.2)",
                }}
              >
                <p className="mb-2 text-xs text-fuchsia-300/50 uppercase tracking-wider font-semibold">Your progress</p>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-white/70">Current XP</span>
                  <span className="font-mono font-bold text-fuchsia-300">{myXp.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-white/70">XP needed</span>
                  <span className="font-mono font-bold text-fuchsia-300">
                    {Math.max(0, RANKER_MIN_XP - myXp).toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, (myXp / RANKER_MIN_XP) * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-fuchsia-300/40">
                  {((myXp / RANKER_MIN_XP) * 100).toFixed(1)}% of the way there
                </p>
              </div>
            )}
            {!isSignedIn && (
              <p className="text-xs text-muted-foreground/50">Sign in to track your progress.</p>
            )}
          </div>
        ) : rankingsLoading ? (
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
        {isRanker && (
          <p className="text-center text-xs text-muted-foreground/40 mt-8">
            Only writers who have reached 200,000 XP appear here.
          </p>
        )}
      </div>
    </div>
  );
}
