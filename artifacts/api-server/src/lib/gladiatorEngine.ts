import { WebSocket } from "ws";
import type { Room, Participant, GladiatorMatchStats } from "./roomManager";

// HP constants
const MAX_HP = 1000;
const HEAL_PER_WORD = 0.5; // 10 words = +5 HP

// Buff keys
export const G_BUFF = {
  FRENZY: "frenzy_heal",
  WOUND: "wound",
  LAST_STAND: "last_stand",
  MOMENTUM: "momentum",
} as const;

// Buff durations / thresholds
const FRENZY_WORDS = 100;
const FRENZY_WINDOW_MS = 80_000; // 1:20 min
const FRENZY_BONUS_HP = 50;

const WOUND_LEAD_MS = 5 * 60_000; // 5 min ahead without closing
const WOUND_CLOSE_THRESHOLD_RATIO = 0.25; // within 25% of death gap clears wound
const WOUND_HEAL_PENALTY = 0.7;

const MOMENTUM_CLOSE_MS = 2 * 60_000; // 2 min consistent closing
const MOMENTUM_HEAL_BONUS = 1.2;

const LAST_STAND_HP_THRESHOLD = 200;
const LAST_STAND_HEAL_BONUS = 2.0;

function sendToParticipant(p: Participant, msg: object): void {
  if (p.ws.readyState === WebSocket.OPEN) {
    p.ws.send(JSON.stringify(msg));
  }
}

function hasBuff(p: Participant, buff: string): boolean {
  return p.gladiatorBuffs.includes(buff);
}

function addBuff(p: Participant, buff: string): boolean {
  if (hasBuff(p, buff)) return false;
  p.gladiatorBuffs.push(buff);
  return true;
}

function removeBuff(p: Participant, buff: string): boolean {
  const idx = p.gladiatorBuffs.indexOf(buff);
  if (idx === -1) return false;
  p.gladiatorBuffs.splice(idx, 1);
  return true;
}

export function initGladiatorParticipant(p: Participant): void {
  p.gladiatorHp = MAX_HP;
  p.gladiatorBuffs = [];
  p.gladiatorFrenzyStartWc = p.wordCount;
  p.gladiatorFrenzyStartTime = Date.now();
  p.gladiatorAheadSince = null;
  p.gladiatorMomentumSince = null;
  p.gladiatorMomentumGapAtStart = null;
  p.gladiatorWoundSince = null;
  p.gladiatorWoundGapAtStart = null;
}

/**
 * Called on every text_update in gladiator mode.
 * Returns { executed: boolean, winnerId: string | null }
 */
export function processGladiatorUpdate(
  room: Room,
  updatedParticipant: Participant,
  newWordCount: number,
  prevWordCount: number,
): { executed: boolean; winnerId: string | null } {
  const deathGap = room.gladiatorDeathGap ?? 400;
  const stats = room.gladiatorMatchStats!;

  const active = Array.from(room.participants.values()).filter((p) => !p.isSpectator);
  if (active.length < 2) return { executed: false, winnerId: null };

  const me = updatedParticipant;
  const opponent = active.find((p) => p.id !== me.id);
  if (!opponent) return { executed: false, winnerId: null };

  const now = Date.now();
  const newWords = Math.max(0, newWordCount - prevWordCount);

  // ── Compute current gap ──────────────────────────────────────────────────
  const gap = newWordCount - opponent.wordCount; // positive = I am ahead
  const absGap = Math.abs(gap);
  const meAhead = gap > 0;

  // ── Track stats ──────────────────────────────────────────────────────────
  if (stats.closestGap === -1 || absGap < stats.closestGap) stats.closestGap = absGap;
  if (absGap > stats.maxGap) stats.maxGap = absGap;

  // Track lead changes
  const currentLeader = gap > 0 ? me.id : (gap < 0 ? opponent.id : null);
  if (currentLeader && currentLeader !== stats.currentLeaderId) {
    if (stats.currentLeaderId !== null) stats.leadChanges++;
    stats.currentLeaderId = currentLeader;
  }

  // Danger zone: gap > 75% of death gap
  if (absGap > deathGap * 0.75) {
    stats.timeInDangerMs += 1000; // approximate per update
  }

  // ── Execution check ──────────────────────────────────────────────────────
  const loser = gap >= deathGap ? opponent : (gap <= -deathGap ? me : null);
  const winner = loser ? (loser.id === me.id ? opponent : me) : null;
  if (loser && winner) {
    stats.endedByExecution = true;
    return { executed: true, winnerId: winner.id };
  }

  // ── Update me: buffs + heal ──────────────────────────────────────────────
  updateCombatantBuffs(me, opponent, absGap, meAhead, deathGap, now);
  const healedHp = applyHeal(me, newWords, stats);

  // ── Gap damage to the one who is BEHIND ─────────────────────────────────
  // Damage applies to the participant behind, computed every update.
  // We do it from both sides: each participant gets damaged according to how
  // far behind they are.  Since we're called per update, just apply damage
  // to both based on current gap.
  applyGapDamage(me, opponent, absGap, deathGap);

  // Clamp HP
  me.gladiatorHp = Math.max(0, Math.min(MAX_HP, me.gladiatorHp));
  opponent.gladiatorHp = Math.max(0, Math.min(MAX_HP, opponent.gladiatorHp));

  // ── Broadcast state to both ──────────────────────────────────────────────
  broadcastGladiatorState(me, opponent, absGap, deathGap);

  return { executed: false, winnerId: null };
}

function updateCombatantBuffs(
  me: Participant,
  opponent: Participant,
  absGap: number,
  meAhead: boolean,
  deathGap: number,
  now: number,
): void {
  // ── Last Stand ───────────────────────────────────────────────────────────
  const wasLastStand = hasBuff(me, G_BUFF.LAST_STAND);
  if (me.gladiatorHp < LAST_STAND_HP_THRESHOLD) {
    addBuff(me, G_BUFF.LAST_STAND);
  } else {
    removeBuff(me, G_BUFF.LAST_STAND);
  }

  // ── Wound tracking ───────────────────────────────────────────────────────
  if (!meAhead) {
    // opponent is ahead — start wound timer if not already tracking
    if (me.gladiatorWoundSince === null) {
      me.gladiatorWoundSince = now;
      me.gladiatorWoundGapAtStart = absGap;
    } else {
      const aheadMs = now - me.gladiatorWoundSince;
      const gapGrew = absGap >= (me.gladiatorWoundGapAtStart ?? absGap);
      if (aheadMs >= WOUND_LEAD_MS && gapGrew) {
        addBuff(me, G_BUFF.WOUND);
      }
    }
  } else {
    me.gladiatorWoundSince = null;
    me.gladiatorWoundGapAtStart = null;
  }

  // Clear wound when gap closes enough
  if (hasBuff(me, G_BUFF.WOUND) && absGap <= deathGap * WOUND_CLOSE_THRESHOLD_RATIO) {
    removeBuff(me, G_BUFF.WOUND);
    me.gladiatorWoundSince = null;
  }

  // ── Momentum tracking ────────────────────────────────────────────────────
  if (!meAhead) {
    // I'm behind — check if I'm consistently closing
    if (me.gladiatorMomentumSince === null) {
      me.gladiatorMomentumSince = now;
      me.gladiatorMomentumGapAtStart = absGap;
    } else {
      const closing = absGap < (me.gladiatorMomentumGapAtStart ?? absGap);
      const closingMs = now - me.gladiatorMomentumSince;
      if (closing && closingMs >= MOMENTUM_CLOSE_MS) {
        addBuff(me, G_BUFF.MOMENTUM);
      } else if (!closing) {
        // Gap grew — reset momentum
        me.gladiatorMomentumSince = now;
        me.gladiatorMomentumGapAtStart = absGap;
        removeBuff(me, G_BUFF.MOMENTUM);
      }
    }
  } else {
    // I'm ahead — clear momentum
    me.gladiatorMomentumSince = null;
    me.gladiatorMomentumGapAtStart = null;
    removeBuff(me, G_BUFF.MOMENTUM);
  }
}

function applyHeal(me: Participant, newWords: number, stats: GladiatorMatchStats): number {
  if (newWords <= 0) return 0;

  let multiplier = 1.0;
  if (hasBuff(me, G_BUFF.LAST_STAND)) multiplier *= LAST_STAND_HEAL_BONUS;
  if (hasBuff(me, G_BUFF.WOUND)) multiplier *= WOUND_HEAL_PENALTY;
  if (hasBuff(me, G_BUFF.MOMENTUM)) multiplier *= MOMENTUM_HEAL_BONUS;

  let heal = newWords * HEAL_PER_WORD * multiplier;

  // Frenzy heal check — 100 words in under 80 seconds
  const now = Date.now();
  if (me.wordCount - me.gladiatorFrenzyStartWc >= FRENZY_WORDS) {
    const elapsed = now - me.gladiatorFrenzyStartTime;
    if (elapsed <= FRENZY_WINDOW_MS) {
      heal += FRENZY_BONUS_HP;
      sendToParticipant(me, { type: "gladiator_buff", buff: G_BUFF.FRENZY, active: true });
    }
    // Reset frenzy window
    me.gladiatorFrenzyStartWc = me.wordCount;
    me.gladiatorFrenzyStartTime = now;
  }

  me.gladiatorHp = Math.min(MAX_HP, me.gladiatorHp + heal);
  stats.totalHpHealed[me.id] = (stats.totalHpHealed[me.id] ?? 0) + heal;

  return heal;
}

function applyGapDamage(me: Participant, opponent: Participant, absGap: number, deathGap: number): void {
  const gapRatio = absGap / deathGap;
  // Damage per second (applied per word_update, so it's light — scales with activity):
  // 0-25%: 0 dmg, 25-50%: 1/s, 50-75%: 2/s, 75-100%: 4/s
  let dmgPerSecond = 0;
  if (gapRatio >= 0.75) dmgPerSecond = 4;
  else if (gapRatio >= 0.50) dmgPerSecond = 2;
  else if (gapRatio >= 0.25) dmgPerSecond = 1;

  if (dmgPerSecond === 0) return;

  // Apply to whoever is behind (the one with lower word count)
  const behind = me.wordCount < opponent.wordCount ? me : opponent;
  behind.gladiatorHp = Math.max(0, behind.gladiatorHp - dmgPerSecond);
}

export function broadcastGladiatorState(
  p1: Participant,
  p2: Participant,
  absGap: number,
  deathGap: number,
): void {
  const send = (me: Participant, opp: Participant) => {
    sendToParticipant(me, {
      type: "gladiator_state",
      myHp: Math.round(me.gladiatorHp),
      opponentHp: Math.round(opp.gladiatorHp),
      myWordCount: me.wordCount,
      opponentWordCount: opp.wordCount,
      gap: absGap,
      iAhead: me.wordCount >= opp.wordCount,
      deathGap,
      myBuffs: me.gladiatorBuffs,
      opponentBuffs: opp.gladiatorBuffs,
    });
  };
  send(p1, p2);
  send(p2, p1);
}

export function broadcastGladiatorExecution(
  room: Room,
  winner: Participant,
  loser: Participant,
  stats: GladiatorMatchStats,
): void {
  const sharedStats = {
    closestGap: stats.closestGap === -1 ? 0 : stats.closestGap,
    maxGap: stats.maxGap,
    leadChanges: stats.leadChanges,
    timeInDangerMs: stats.timeInDangerMs,
    endedByExecution: stats.endedByExecution,
    totalHpHealed: stats.totalHpHealed,
  };

  sendToParticipant(winner, {
    type: "gladiator_execution",
    outcome: "victory",
    myHp: Math.round(winner.gladiatorHp),
    opponentHp: Math.round(loser.gladiatorHp),
    myWordCount: winner.wordCount,
    opponentWordCount: loser.wordCount,
    stats: sharedStats,
  });

  sendToParticipant(loser, {
    type: "gladiator_execution",
    outcome: "defeat",
    myHp: Math.round(loser.gladiatorHp),
    opponentHp: Math.round(winner.gladiatorHp),
    myWordCount: loser.wordCount,
    opponentWordCount: winner.wordCount,
    stats: sharedStats,
  });
}

export function broadcastGladiatorTimerEnd(
  room: Room,
  p1: Participant,
  p2: Participant,
  stats: GladiatorMatchStats,
): void {
  const HP_DRAW_THRESHOLD = 50;
  const isDraw = Math.abs(p1.gladiatorHp - p2.gladiatorHp) <= HP_DRAW_THRESHOLD;
  const winner = isDraw ? null : (p1.gladiatorHp > p2.gladiatorHp ? p1 : p2);
  const loser = winner ? (winner.id === p1.id ? p2 : p1) : null;

  const sharedStats = {
    closestGap: stats.closestGap === -1 ? 0 : stats.closestGap,
    maxGap: stats.maxGap,
    leadChanges: stats.leadChanges,
    timeInDangerMs: stats.timeInDangerMs,
    endedByExecution: false,
    totalHpHealed: stats.totalHpHealed,
  };

  const sendResult = (me: Participant, opp: Participant) => {
    let outcome: "victory" | "defeat" | "draw";
    if (isDraw) outcome = "draw";
    else if (me.id === winner?.id) outcome = "victory";
    else outcome = "defeat";

    sendToParticipant(me, {
      type: "gladiator_execution",
      outcome,
      myHp: Math.round(me.gladiatorHp),
      opponentHp: Math.round(opp.gladiatorHp),
      myWordCount: me.wordCount,
      opponentWordCount: opp.wordCount,
      stats: sharedStats,
    });
  };

  sendResult(p1, p2);
  sendResult(p2, p1);
}
