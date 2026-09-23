import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { GladiatorResult } from "@/hooks/useSprintRoom";
import { BattleCharacter } from "./BattleCharacter";
import { Button } from "./ui/button";
import "./battle-rooms.css";

interface GladiatorResultsProps {
  result: GladiatorResult;
  participantId: string | null;
  onClose?: () => void;
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-xs font-medium tabular-nums text-right">{value}</dd>
  </div>;
}

export function GladiatorResults({ result, participantId, onClose }: GladiatorResultsProps) {
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); onClose?.(); };
  const { outcome, myHp, opponentHp, myWordCount, opponentWordCount, stats } = result;
  const isVictory = outcome === "victory";
  const isDraw = outcome === "draw";
  const healed = participantId ? Math.round(stats.totalHpHealed[participantId] ?? 0) : 0;
  const seconds = Math.floor(Math.max(0, stats.timeInDangerMs) / 1000);
  const reason = stats.endedByExecution
    ? (isVictory ? "Your word lead settled the duel." : "The word gap grew too wide this round.")
    : isDraw ? "Equal health at the final bell. An even match." : "The bell rang. Remaining health decided the match.";

  return <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-sm max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground p-6 shadow-xl">
        <div className="mx-auto w-28"><BattleCharacter character={4} label={isVictory ? "Victorious gladiator" : isDraw ? "Your gladiator" : "Defeated gladiator"} defeated={!isVictory && !isDraw} /></div>
        <Dialog.Title className="font-serif text-3xl text-center font-bold">{isVictory ? "Victory" : isDraw ? "An even match" : "A hard-fought duel"}</Dialog.Title>
        <Dialog.Description className="mt-2 text-center text-sm text-muted-foreground">{reason}</Dialog.Description>
        <div className="grid grid-cols-2 gap-4 my-5 rounded-xl bg-muted/50 p-4 text-center tabular-nums">
          <div><p className="text-xs text-muted-foreground">You</p><p className="text-2xl font-semibold mt-1">{Math.ceil(Math.max(0, myHp))}<span className="text-xs font-normal text-muted-foreground"> HP</span></p><p className="text-xs text-muted-foreground mt-1">{myWordCount.toLocaleString()} words</p></div>
          <div><p className="text-xs text-muted-foreground">Challenger</p><p className="text-2xl font-semibold mt-1">{Math.ceil(Math.max(0, opponentHp))}<span className="text-xs font-normal text-muted-foreground"> HP</span></p><p className="text-xs text-muted-foreground mt-1">{opponentWordCount.toLocaleString()} words</p></div>
        </div>
        <dl className="mb-5">
          <StatRow label="Closest gap" value={`${Math.max(0, stats.closestGap)} words`} />
          <StatRow label="Largest gap" value={`${stats.maxGap} words`} />
          <StatRow label="Health restored by writing" value={`${healed} HP`} />
          <StatRow label="Lead changes" value={stats.leadChanges} />
          <StatRow label="Time in danger" value={seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`} />
        </dl>
        <Button onClick={close} className="w-full min-h-10">Review your writing</Button>
        <a href="/portal" className="flex min-h-10 items-center justify-center mt-2 text-sm text-muted-foreground hover:text-foreground">Return to the portal</a>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
