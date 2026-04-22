import type { GladiatorResult } from "@/hooks/useSprintRoom";

interface GladiatorResultsProps {
  result: GladiatorResult;
  participantId: string | null;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-mono font-bold text-white/80">{value}</span>
    </div>
  );
}

export function GladiatorResults({ result, participantId }: GladiatorResultsProps) {
  const { outcome, myHp, opponentHp, myWordCount, opponentWordCount, stats } = result;
  const isVictory = outcome === "victory";
  const isDraw = outcome === "draw";

  const myHealedHp = participantId ? Math.round(stats.totalHpHealed[participantId] ?? 0) : 0;
  const dangerMin = Math.round(stats.timeInDangerMs / 60_000);
  const dangerSec = Math.round((stats.timeInDangerMs % 60_000) / 1000);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.95)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,10,20,0.98)",
          border: isVictory
            ? "1px solid rgba(251,191,36,0.4)"
            : isDraw
            ? "1px solid rgba(148,163,184,0.3)"
            : "1px solid rgba(239,68,68,0.3)",
          boxShadow: isVictory
            ? "0 0 60px rgba(251,191,36,0.15), 0 24px 64px rgba(0,0,0,0.8)"
            : "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        {/* Outcome header */}
        <div
          className="px-6 py-8 text-center"
          style={{
            background: isVictory
              ? "linear-gradient(180deg, rgba(251,191,36,0.12) 0%, transparent 100%)"
              : isDraw
              ? "linear-gradient(180deg, rgba(148,163,184,0.08) 0%, transparent 100%)"
              : "linear-gradient(180deg, rgba(239,68,68,0.1) 0%, transparent 100%)",
          }}
        >
          <div className="text-4xl mb-3">
            {isVictory ? "⚔️" : isDraw ? "🤝" : "💀"}
          </div>
          <h1
            className="font-serif text-3xl font-black tracking-tight mb-1"
            style={{
              color: isVictory ? "#fbbf24" : isDraw ? "#94a3b8" : "#ef4444",
              textShadow: isVictory ? "0 0 30px rgba(251,191,36,0.4)" : isDraw ? "none" : "0 0 20px rgba(239,68,68,0.3)",
            }}
          >
            {isVictory ? "Victory" : isDraw ? "Draw" : "You have fallen"}
          </h1>
          {stats.endedByExecution && !isVictory && (
            <p className="text-xs text-white/30 italic tracking-wider mt-0.5">The gap was your undoing</p>
          )}
          {stats.endedByExecution && isVictory && (
            <p className="text-xs text-white/30 italic tracking-wider mt-0.5">You executed your opponent</p>
          )}
          {!stats.endedByExecution && (
            <p className="text-xs text-white/30 italic tracking-wider mt-0.5">
              {isDraw ? "Both gladiators fought with equal fury" : "Timer's verdict: HP decides fate"}
            </p>
          )}
        </div>

        {/* HP comparison */}
        <div className="px-6 pb-4">
          <div className="flex items-end justify-center gap-6 py-4">
            <div className="text-center">
              <div
                className="text-3xl font-mono font-black tabular-nums"
                style={{ color: myHp < 200 ? "#ef4444" : myHp < 500 ? "#f97316" : "#22c55e" }}
              >
                {myHp}
              </div>
              <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Your HP</div>
            </div>
            <div className="text-white/20 text-2xl font-light mb-1">vs</div>
            <div className="text-center">
              <div className="text-3xl font-mono font-black tabular-nums text-white/40">
                {opponentHp}
              </div>
              <div className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Opponent HP</div>
            </div>
          </div>

          <div className="flex gap-4 text-center pt-2">
            <div className="flex-1">
              <div className="text-lg font-mono font-bold text-white/80">{myWordCount}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-wider">Your words</div>
            </div>
            <div className="flex-1">
              <div className="text-lg font-mono font-bold text-white/40">{opponentWordCount}</div>
              <div className="text-[9px] text-white/30 uppercase tracking-wider">Their words</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className="mx-4 mb-4 rounded-xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[9px] text-white/25 uppercase tracking-widest mb-2 font-semibold">Match Stats</div>
          <StatRow label="Closest gap" value={`${stats.closestGap} words`} />
          <StatRow label="Max gap reached" value={`${stats.maxGap} words`} />
          <StatRow label="HP healed by writing" value={`${myHealedHp} HP`} />
          <StatRow label="Lead changes" value={stats.leadChanges} />
          <StatRow label="Time in danger zone" value={dangerMin > 0 ? `${dangerMin}m ${dangerSec}s` : `${dangerSec}s`} />
          <StatRow label="Ended by" value={stats.endedByExecution ? "Execution ⚔️" : "Timer ⏱️"} />
        </div>

        {/* Return button */}
        <div className="px-4 pb-5">
          <button
            type="button"
            onClick={() => window.location.href = "/"}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95"
            style={{
              background: isVictory ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
              border: isVictory ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.1)",
              color: isVictory ? "#fbbf24" : "#ffffff80",
            }}
          >
            Return to the portal
          </button>
        </div>
      </div>
    </div>
  );
}
