import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ArrowLeft, Calendar, CalendarDays, Gift, Loader2, CheckCircle2, Coins, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChestIcon } from "@/components/ChestIcon";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChestType = "mortal" | "iron" | "crystal" | "inferno" | "immortal";
type Reward =
  | { kind: "chest"; chestType: ChestType; qty: number }
  | { kind: "coins"; amount: number }
  | { kind: "xp"; amount: number };

interface QuestRow {
  id: string;
  scope: "daily" | "weekly";
  title: string;
  description: string;
  target: number;
  progress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  reward: Reward;
  rewardLabel: string;
  resetsAt: string;
}

const CHEST_TINT: Record<ChestType, string> = {
  mortal:   "from-stone-50 to-zinc-100 dark:from-zinc-800/60 dark:to-zinc-900/80 border-zinc-200 dark:border-zinc-700",
  iron:     "from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/80 border-slate-300 dark:border-slate-600",
  crystal:  "from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 border-blue-300 dark:border-blue-600",
  inferno:  "from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-orange-400 dark:border-orange-600",
  immortal: "from-violet-50 to-fuchsia-50 dark:from-violet-900/30 dark:to-fuchsia-900/30 border-violet-400 dark:border-violet-600",
};

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function RewardChip({ reward }: { reward: Reward }) {
  if (reward.kind === "chest") {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <ChestIcon type={reward.chestType} className="h-5 w-5" />
        <span className="capitalize">{reward.qty > 1 ? `${reward.qty}× ` : ""}{reward.chestType} Chest</span>
      </div>
    );
  }
  if (reward.kind === "coins") {
    return (
      <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <Coins className="h-4 w-4" /> {reward.amount} Coins
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 dark:text-purple-400">
      <Sparkles className="h-4 w-4" /> {reward.amount} XP
    </div>
  );
}

function QuestCard({ q, onClaim, claiming }: {
  q: QuestRow;
  onClaim: (id: string) => void;
  claiming: boolean;
}) {
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
  const tint = q.reward.kind === "chest"
    ? CHEST_TINT[q.reward.chestType]
    : "from-zinc-50 to-white dark:from-zinc-800/40 dark:to-zinc-900/60 border-zinc-200 dark:border-zinc-700";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tint} p-4 shadow-sm transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{q.title}</h3>
            {q.isClaimed && (
              <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-400 text-[10px] py-0 px-1.5">
                Claimed
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{q.description}</p>
        </div>
        <RewardChip reward={q.reward} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1">
          <span>{q.progress.toLocaleString()} / {q.target.toLocaleString()}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
          <div
            className={`h-full rounded-full transition-all ${
              q.isClaimed
                ? "bg-emerald-500"
                : q.isCompleted
                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                : "bg-gradient-to-r from-blue-400 to-indigo-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Resets in {formatCountdown(q.resetsAt)}
        </span>
        {q.isClaimed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Reward collected
          </span>
        ) : q.isCompleted ? (
          <Button
            size="sm"
            onClick={() => onClaim(q.id)}
            disabled={claiming}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="h-4 w-4 mr-1" /> Claim</>}
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">In progress</span>
        )}
      </div>
    </div>
  );
}

export default function Quests() {
  const [, navigate] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const af = useAuthedFetch();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-quests"],
    queryFn: async (): Promise<{ quests: QuestRow[] }> => {
      const res = await af(`${basePath}/api/user/quests`);
      if (!res.ok) throw new Error("Failed to load quests");
      return res.json();
    },
    enabled: !!isSignedIn,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const claim = useMutation({
    mutationFn: async (questId: string) => {
      const res = await af(`${basePath}/api/user/quests/${encodeURIComponent(questId)}/claim`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Claim failed");
      return body as { rewardLabel: string };
    },
    onSuccess: (body) => {
      toast({ title: "Quest claimed!", description: `Reward: ${body.rewardLabel}` });
      qc.invalidateQueries({ queryKey: ["user-quests"] });
      qc.invalidateQueries({ queryKey: ["chests"] });
      qc.invalidateQueries({ queryKey: ["user-coins"] });
      qc.invalidateQueries({ queryKey: ["ownPrefs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't claim", description: err.message, variant: "destructive" });
    },
  });

  const { daily, weekly } = useMemo(() => {
    const list = data?.quests ?? [];
    return {
      daily: list.filter((q) => q.scope === "daily"),
      weekly: list.filter((q) => q.scope === "weekly"),
    };
  }, [data]);

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Sign in to view daily and weekly quests.
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 ml-[var(--sb-w,260px)]">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portal")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quests</h1>
          <p className="text-sm text-muted-foreground">
            New objectives every day and week. Claim your rewards before the timer resets.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading quests…</div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Couldn't load quests. Try again later.
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold">Daily Quests</h2>
              <Badge variant="outline" className="ml-1">{daily.filter(q => q.isClaimed).length}/{daily.length} claimed</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {daily.map((q) => (
                <QuestCard key={q.id} q={q} onClaim={(id) => claim.mutate(id)} claiming={claim.isPending && claim.variables === q.id} />
              ))}
              {daily.length === 0 && <p className="text-sm text-muted-foreground">No daily quests rolled.</p>}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold">Weekly Quests</h2>
              <Badge variant="outline" className="ml-1">{weekly.filter(q => q.isClaimed).length}/{weekly.length} claimed</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {weekly.map((q) => (
                <QuestCard key={q.id} q={q} onClaim={(id) => claim.mutate(id)} claiming={claim.isPending && claim.variables === q.id} />
              ))}
              {weekly.length === 0 && <p className="text-sm text-muted-foreground">No weekly quests rolled.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
