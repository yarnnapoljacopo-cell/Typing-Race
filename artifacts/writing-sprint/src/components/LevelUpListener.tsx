import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getRankFromXp, RANKS, type Rank } from "@/lib/ranks";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const borderColorMap: Record<number, string> = {
  0: "#71717a", 1: "#94a3b8", 2: "#f97316", 3: "#8b5cf6",
  4: "#dc2626", 5: "#facc15", 6: "#22d3ee", 7: "#e879f9",
};
const bgMap: Record<number, string> = {
  0: "#1c1c20", 1: "#1e2130", 2: "#1c1008", 3: "#1a1030",
  4: "#1c0808", 5: "#201800", 6: "#080c20", 7: "#1a0020",
};
const glowMap: Record<number, string> = {
  0: "0 0 20px rgba(161,161,170,0.45)",
  1: "0 0 22px rgba(148,163,184,0.5)",
  2: "0 0 26px rgba(249,115,22,0.6)",
  3: "0 0 28px rgba(139,92,246,0.65)",
  4: "0 0 32px rgba(220,38,38,0.7)",
  5: "0 0 36px rgba(250,204,21,0.75)",
  6: "0 0 40px rgba(34,211,238,0.8), 0 0 80px rgba(34,211,238,0.35)",
  7: "0 0 44px rgba(232,121,249,0.9), 0 0 90px rgba(232,121,249,0.4)",
};

interface ProfileXp { xp: number; }

async function fetchXp(
  af: (url: string, opts?: RequestInit) => Promise<Response>,
): Promise<ProfileXp | null> {
  const res = await af(`${basePath}/api/user/profile`);
  if (!res.ok) return null;
  const data = await res.json();
  return { xp: typeof data.xp === "number" ? data.xp : 0 };
}

export function LevelUpListener() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const lastIndexRef = useRef<number | null>(null);
  const knownUserIdRef = useRef<string | null>(null);
  const [achievedRank, setAchievedRank] = useState<Rank | null>(null);

  // Reset listener state when the signed-in user changes (sign-out/sign-in
  // in the same tab). Without this, user B inherits user A's baseline and
  // could see a spurious rank-up modal — or none at all.
  useEffect(() => {
    const id = user?.id ?? null;
    if (knownUserIdRef.current !== id) {
      knownUserIdRef.current = id;
      lastIndexRef.current = null;
      setAchievedRank(null);
    }
  }, [user?.id]);

  const { data } = useQuery({
    queryKey: ["levelup-xp", user?.id ?? "anon"],
    queryFn: () => fetchXp(af),
    enabled: isLoaded && !!isSignedIn && !!user?.id,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user || data == null) return;
    const newIndex = getRankFromXp(data.xp).index;
    const storageKey = `lastSeenRankIndex:${user.id}`;

    if (lastIndexRef.current == null) {
      // First mount — read from storage; if absent, seed without animating.
      const stored = Number(window.localStorage.getItem(storageKey) ?? "");
      const baseline = Number.isFinite(stored) ? stored : newIndex;
      lastIndexRef.current = baseline;
      window.localStorage.setItem(storageKey, String(Math.max(baseline, newIndex)));
      // Don't celebrate on initial load — even if storage was lower than newIndex,
      // we don't know whether the level-up happened in this session or before.
      return;
    }

    if (newIndex > lastIndexRef.current) {
      lastIndexRef.current = newIndex;
      window.localStorage.setItem(storageKey, String(newIndex));
      setAchievedRank(RANKS[newIndex] ?? null);
      // Refresh anything that displays rank/xp
      qc.invalidateQueries({ queryKey: ["ownPrefs"] });
      qc.invalidateQueries({ queryKey: ["own-prefs"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } else if (newIndex < lastIndexRef.current) {
      // Decay or admin adjustment — quietly reset baseline so we don't
      // re-celebrate an already-seen rank.
      lastIndexRef.current = newIndex;
      window.localStorage.setItem(storageKey, String(newIndex));
    }
  }, [data, user, qc]);

  if (!achievedRank) return null;

  const color = borderColorMap[achievedRank.index];
  return (
    <Dialog open onOpenChange={(v) => !v && setAchievedRank(null)}>
      <DialogContent className="max-w-sm text-center overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">Rank Up: {achievedRank.title}</DialogTitle>
          <DialogDescription className="sr-only">{achievedRank.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4 px-2">
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color,
              textShadow: achievedRank.index >= 4 ? `0 0 8px ${color}` : "none",
            }}
          >
            ★ Rank Up ★
          </div>

          <div
            style={{
              width: 120, height: 120, borderRadius: "50%",
              border: `4px solid ${color}`,
              background: bgMap[achievedRank.index],
              boxShadow: glowMap[achievedRank.index],
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "rank-up-pulse 2s ease-in-out infinite",
            }}
          >
            <span style={{ fontSize: "3.2rem" }}>{achievedRank.emoji}</span>
          </div>

          <div>
            <div
              style={{
                fontSize: "1.2rem", fontWeight: 900,
                color, textShadow: achievedRank.index >= 4 ? `0 0 10px ${color}` : "none",
                letterSpacing: "0.04em",
              }}
            >
              {achievedRank.title}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#7a7a92", fontStyle: "italic", marginTop: 4 }}>
              {achievedRank.subtitle}
            </div>
          </div>

          <div
            style={{
              fontSize: "0.78rem", fontWeight: 700, padding: "5px 14px",
              borderRadius: 999, background: bgMap[achievedRank.index],
              color, border: `1px solid ${color}50`,
            }}
          >
            {achievedRank.minXp.toLocaleString()}+ XP
          </div>

          <button
            onClick={() => setAchievedRank(null)}
            style={{
              marginTop: 4, padding: "10px 28px", borderRadius: 999,
              background: color, color: achievedRank.index === 5 ? "#1a1a2e" : "white",
              border: "none", fontWeight: 700, fontSize: "0.9rem",
              cursor: "pointer", letterSpacing: "0.04em",
            }}
          >
            Continue writing
          </button>
        </div>

        <style>{`
          @keyframes rank-up-pulse {
            0%, 100% { transform: scale(1); }
            50%      { transform: scale(1.05); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
