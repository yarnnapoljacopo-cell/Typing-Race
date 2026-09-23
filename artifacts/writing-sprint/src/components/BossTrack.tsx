import { memo } from "react";
import { Feather, Shield, Users, Check } from "lucide-react";
import type { Participant } from "@/hooks/useSprintRoom";
import { BattleCharacter, useBattleReaction } from "./BattleCharacter";
import "./battle-rooms.css";

interface BossTrackProps {
  participants: Participant[];
  currentParticipantId: string | null;
  bossWordGoal: number;
  bossDefeated?: boolean;
  isRunning?: boolean;
}
const BOSSES = [
  { name: "Shadow Imp", title: "The ink thief", lore: "Small claws. An appetite for unfinished stories." },
  { name: "Dark Wraith", title: "Keeper of the unwritten", lore: "Give the silence a voice. Break its hold." },
  { name: "Void Tyrant", title: "The ironbound sovereign", lore: "A fortress of armor. A thousand words can break it." },
  { name: "Eldritch Horror", title: "The thing beyond the page", lore: "An ancient darkness. Face it one sentence at a time." },
];

export const BossTrack = memo(function BossTrack({ participants, currentParticipantId, bossWordGoal, bossDefeated = false, isRunning = false }: BossTrackProps) {
  const goal = Number.isFinite(bossWordGoal) && bossWordGoal > 0 ? bossWordGoal : 1;
  const tier = goal > 10000 ? 3 : goal > 5000 ? 2 : goal > 2500 ? 1 : 0;
  const boss = BOSSES[tier];
  const writers = participants.filter(p => p.role !== "editor");
  const total = writers.reduce((sum, p) => sum + Math.max(0, p.wordCount), 0);
  const defeated = bossDefeated || total >= goal;
  const remaining = defeated ? 0 : Math.max(0, goal - total);
  const hp = remaining / goal * 100;
  const phase = defeated ? "Defeated" : !isRunning ? "Awaiting the party" : hp <= 15 ? "Final stand" : hp <= 40 ? "Enraged" : hp <= 70 ? "Wounded" : "Unbroken";
  const reaction = useBattleReaction(total, isRunning && !defeated);
  const mine = writers.find(p => p.id === currentParticipantId);
  return <section className={`battle-panel boss-battle${defeated ? " battle-won" : ""}`} aria-label="Boss battle">
    <header className="battle-heading"><span><Shield size={13} /> BOSS BATTLE <span className="battle-separator">/</span> COOPERATIVE</span><span><Users size={13} />{writers.length} {writers.length === 1 ? "writer" : "writers"}</span></header>
    <div className="boss-encounter">
      <div className="boss-art"><BattleCharacter character={tier} label={`${boss.name}, ${boss.title}`} defeated={defeated} hit={!!reaction} hitId={reaction?.id} />{reaction && <span key={reaction.id} className="battle-damage-number">−{reaction.amount}</span>}</div>
      <div className="boss-details">
        <p className="battle-eyebrow">{boss.title}</p>
        <div className="boss-title"><h2>{boss.name}</h2><span className={`battle-phase${defeated ? " is-won" : ""}`}>{defeated && <Check size={12} />}{phase}</span></div>
        <p className="battle-lore">{defeated ? "The last word is yours. Well written, everyone." : boss.lore}</p>
        <div className="battle-health-label"><span>BOSS HEALTH</span><strong>{Math.ceil(remaining).toLocaleString()} <small>/ {goal.toLocaleString()}</small></strong></div>
        <div className="battle-health" role="progressbar" aria-label="Boss health remaining" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={remaining} aria-valuetext={`${remaining} words remaining to defeat the boss`}><div style={{ width: `${hp}%` }} /></div>
        <div className="battle-progress-copy"><span>{Math.min(total, goal).toLocaleString()} words landed</span><span>{Math.round(100 - hp)}% complete</span></div>
      </div>
    </div>
    <footer className="battle-footer"><span><Feather size={13} />{mine ? `Your contribution: ${mine.wordCount.toLocaleString()} words` : "Watching the party"}</span><span>{isRunning ? "Every word deals 1 damage." : "Words count when the sprint begins."}</span></footer>
  </section>;
});
