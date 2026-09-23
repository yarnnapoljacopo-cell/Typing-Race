import { memo } from "react";
import { Swords, Shield, Zap, Heart, TrendingUp, UserRound } from "lucide-react";
import type { GladiatorState } from "@/hooks/useSprintRoom";
import { BattleCharacter, useBattleReaction } from "./BattleCharacter";
import "./battle-rooms.css";

const BUFFS = {
  frenzy_heal: { label: "Frenzy", Icon: Zap, description: "A burst of writing restores extra health." },
  wound: { label: "Wounded", Icon: Heart, description: "Healing is reduced. Close the word gap to recover." },
  last_stand: { label: "Last stand", Icon: Shield, description: "Low health: your last-stand healing is active." },
  momentum: { label: "Momentum", Icon: TrendingUp, description: "You are closing the gap; bonus healing is active." },
};
export interface GladiatorHUDProps { state: GladiatorState; deathGap: number; myName: string; opponentName: string | null; isRunning: boolean; }
const safeHp = (hp: number) => Math.max(0, Math.min(1000, Number.isFinite(hp) ? hp : 1000));
function Fighter({ name, hp, words, buffs, opponent = false, absent = false, isRunning = false }: { name: string; hp: number; words: number; buffs: string[]; opponent?: boolean; absent?: boolean; isRunning?: boolean }) {
  const health = safeHp(hp);
  const attack = useBattleReaction(words, isRunning && !absent);
  const damage = useBattleReaction(health, isRunning && !absent, "decrease");
  return <div className={`arena-fighter${opponent ? " arena-opponent" : ""}${absent ? " arena-absent" : ""}`}>
    <div className="arena-portrait">{absent ? <div className="arena-empty"><UserRound size={32} /><span>Challenger wanted</span></div> : <BattleCharacter character={opponent ? 5 : 4} label={`${name}'s gladiator`} defeated={health === 0} attacking={!!attack} hit={!!damage} attackId={attack?.id} hitId={damage?.id} />}</div>
    <div className="arena-fighter-details"><span className="battle-eyebrow">{opponent ? "CHALLENGER" : "YOU"}</span><h3 title={name}>{name}</h3>
      <div className="arena-hp-value"><strong>{absent ? "—" : Math.ceil(health)}</strong><span>/ 1,000 HP</span></div>
      <div className={`battle-health${health <= 200 ? " is-critical" : ""}`} role="progressbar" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={1000} aria-valuenow={absent ? 0 : health}><div style={{ width: `${absent ? 0 : health / 10}%` }} /></div>
      <span className="arena-word-count">{absent ? "Waiting to join" : `${words.toLocaleString()} words`}</span>
      <div className="arena-buffs">{buffs.filter(b => b in BUFFS).map(b => {const {label, Icon, description} = BUFFS[b as keyof typeof BUFFS];return <span key={b} tabIndex={0} title={description} aria-label={`${label}: ${description}`} className={`arena-buff buff-${b}`}><Icon size={10} />{label}</span>;})}</div>
    </div>
  </div>;
}

export const GladiatorHUD = memo(function GladiatorHUD({ state, deathGap, myName, opponentName, isRunning }: GladiatorHUDProps) {
  const hasOpponent = opponentName !== null;
  const limit = Number.isFinite(deathGap) && deathGap > 0 ? deathGap : 400;
  const gap = Math.max(0, state.gap);
  const ratio = Math.min(1, gap / limit);
  const underPressure = isRunning && hasOpponent && !state.iAhead && ratio >= .25;
  const status = !hasOpponent ? "Waiting for a challenger" : !isRunning ? "Ready for the duel" : gap === 0 ? "Evenly matched" : state.iAhead ? "You hold the lead" : "Close the gap";
  return <section className="battle-panel arena-battle" aria-label="Gladiator battle">
    <header className="battle-heading"><span><Swords size={14} />GLADIATOR <span className="battle-separator">/</span> ONE AGAINST ONE</span><span className={underPressure ? "arena-danger-text" : ""}>{status}</span></header>
    <div className="arena-matchup">
      <Fighter isRunning={isRunning} name={myName} hp={state.myHp} words={state.myWordCount} buffs={state.myBuffs} />
      <span className="arena-versus" aria-hidden="true">VS</span>
      <Fighter isRunning={isRunning} name={opponentName ?? "Open seat"} hp={state.opponentHp} words={state.opponentWordCount} buffs={state.opponentBuffs} opponent absent={!hasOpponent} />
    </div>
    <div className="arena-gap-panel"><div className="arena-gap-label"><span>{!isRunning ? "Build a lead. Protect your health." : gap === 0 ? "Word counts are level" : `You are ${gap.toLocaleString()} words ${state.iAhead ? "ahead" : "behind"}`}</span><span>{limit.toLocaleString()}-word gap ends the duel</span></div>
      <div className="arena-gap-track" role="meter" aria-label="Word lead; positive means you lead" aria-valuemin={-limit} aria-valuemax={limit} aria-valuenow={hasOpponent ? Math.max(-limit, Math.min(limit, state.iAhead ? gap : -gap)) : 0}><span className="arena-gap-center" /><span className="arena-gap-marker" style={{ left: `${50 + (hasOpponent ? (state.iAhead ? 1 : -1) * ratio * 50 : 0)}%` }} /></div>
      <p className={underPressure ? "arena-danger-text" : ""}>{underPressure ? `You are losing ${ratio >= .75 ? 4 : ratio >= .5 ? 2 : 1} HP each second. Keep writing to heal and catch up.` : "Writing restores health. At the bell, the healthiest fighter wins."}</p>
    </div>
  </section>;
});
