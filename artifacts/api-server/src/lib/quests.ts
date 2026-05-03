import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import { logger } from "./logger";
import { creditCoins, ensureUserCoins, dailyResetCheck } from "./coinHelper";

// ─────────────────────────────────────────────────────────────────────────────
// Daily & Weekly Quests
//
// Design notes (anti-economy-break):
//   • Each user is rolled 3 random quests per scope (daily, weekly) per period.
//   • Rewards are random across a balanced pool — Inferno/Immortal chests
//     show up in only 1–2 of 10 weekly quests, so the realistic upper bound
//     for a normal player is roughly 1 Crystal + 1 Iron daily and 2 Crystal
//     + 1 Inferno weekly. Comparable to a few sprints of natural drops.
//   • Targets are tuned so a casual player completes ~1/day and ~1/week,
//     while heavy players can sweep all 3+3.
//   • Quests cannot be re-rolled or claimed twice in the same period
//     (UNIQUE (user_id, quest_id, period_key)).
// ─────────────────────────────────────────────────────────────────────────────

export type QuestScope = "daily" | "weekly";
export type QuestMetricKind = "sum" | "max";

export type QuestReward =
  | { kind: "chest"; chestType: "mortal" | "iron" | "crystal" | "inferno" | "immortal"; qty: number }
  | { kind: "coins"; amount: number }
  | { kind: "xp"; amount: number };

export interface QuestDef {
  id: string;
  scope: QuestScope;
  title: string;
  description: string;
  metric: string;
  metricKind: QuestMetricKind;
  target: number;
  reward: QuestReward;
}

const DAILY_QUESTS: QuestDef[] = [
  {
    id: "d_sprint_2", scope: "daily",
    title: "Warmup", description: "Complete 2 sprints today.",
    metric: "sprints_completed", metricKind: "sum", target: 2,
    reward: { kind: "chest", chestType: "mortal", qty: 1 },
  },
  {
    id: "d_sprint_4", scope: "daily",
    title: "Marathon Day", description: "Complete 4 sprints today.",
    metric: "sprints_completed", metricKind: "sum", target: 4,
    reward: { kind: "chest", chestType: "iron", qty: 1 },
  },
  {
    id: "d_words_500", scope: "daily",
    title: "Quill Sharpening", description: "Write 500 words across sprints today.",
    metric: "words_written", metricKind: "sum", target: 500,
    reward: { kind: "xp", amount: 50 },
  },
  {
    id: "d_words_1500", scope: "daily",
    title: "Inkstorm", description: "Write 1,500 words across sprints today.",
    metric: "words_written", metricKind: "sum", target: 1500,
    reward: { kind: "chest", chestType: "iron", qty: 1 },
  },
  {
    id: "d_win_1", scope: "daily",
    title: "First Place", description: "Win 1 sprint today.",
    metric: "sprints_won", metricKind: "sum", target: 1,
    reward: { kind: "coins", amount: 30 },
  },
  {
    id: "d_win_2", scope: "daily",
    title: "Back-to-Back", description: "Win 2 sprints today.",
    metric: "sprints_won", metricKind: "sum", target: 2,
    reward: { kind: "chest", chestType: "mortal", qty: 1 },
  },
  {
    id: "d_open_5", scope: "daily",
    title: "Treasure Hunter", description: "Open 5 chests today.",
    metric: "chests_opened", metricKind: "sum", target: 5,
    reward: { kind: "coins", amount: 20 },
  },
  {
    id: "d_craft_1", scope: "daily",
    title: "Apprentice Alchemist", description: "Successfully craft any item today.",
    metric: "crafts_succeeded", metricKind: "sum", target: 1,
    reward: { kind: "chest", chestType: "mortal", qty: 1 },
  },
  {
    id: "d_kart_1", scope: "daily",
    title: "Pole Position", description: "Complete a Kart-mode sprint.",
    metric: "kart_completed", metricKind: "sum", target: 1,
    reward: { kind: "coins", amount: 25 },
  },
  {
    id: "d_high_wpm", scope: "daily",
    title: "Quickfingers", description: "Reach 50 WPM in a single sprint.",
    metric: "max_wpm", metricKind: "max", target: 50,
    reward: { kind: "chest", chestType: "iron", qty: 1 },
  },
];

// Weekly pool — rebalanced so the realistic worst case from a 3-quest weekly
// roll is ~1 inferno + 2 crystal, or 1 immortal + 2 crystal. High-tier
// chests (inferno × 2, immortal × 1) appear in only 3 of 10 quest slots.
const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: "w_win_3", scope: "weekly",
    title: "Champion's Week", description: "Win 3 sprints this week.",
    metric: "sprints_won", metricKind: "sum", target: 3,
    reward: { kind: "chest", chestType: "crystal", qty: 1 },
  },
  {
    id: "w_sprint_15", scope: "weekly",
    title: "Iron Routine", description: "Complete 15 sprints this week.",
    metric: "sprints_completed", metricKind: "sum", target: 15,
    reward: { kind: "chest", chestType: "crystal", qty: 1 },
  },
  {
    id: "w_words_5000", scope: "weekly",
    title: "Five Thousand Words", description: "Write 5,000 words this week.",
    metric: "words_written", metricKind: "sum", target: 5000,
    reward: { kind: "chest", chestType: "crystal", qty: 1 },
  },
  {
    id: "w_words_15k", scope: "weekly",
    title: "NaNo Pace", description: "Write 15,000 words this week.",
    metric: "words_written", metricKind: "sum", target: 15000,
    reward: { kind: "chest", chestType: "inferno", qty: 1 },
  },
  {
    id: "w_craft_5", scope: "weekly",
    title: "Master Forger", description: "Successfully craft 5 items this week.",
    metric: "crafts_succeeded", metricKind: "sum", target: 5,
    reward: { kind: "chest", chestType: "crystal", qty: 1 },
  },
  {
    id: "w_glad_1", scope: "weekly",
    title: "Enter the Arena", description: "Complete a Gladiator match.",
    metric: "gladiator_completed", metricKind: "sum", target: 1,
    reward: { kind: "chest", chestType: "iron", qty: 1 },
  },
  {
    id: "w_glad_win", scope: "weekly",
    title: "Crowned in Blood", description: "Win a Gladiator match.",
    metric: "gladiator_won", metricKind: "sum", target: 1,
    reward: { kind: "chest", chestType: "inferno", qty: 1 },
  },
  {
    id: "w_kart_3", scope: "weekly",
    title: "Podium Sweep", description: "Win 3 Kart-mode sprints this week.",
    metric: "kart_won", metricKind: "sum", target: 3,
    reward: { kind: "chest", chestType: "crystal", qty: 1 },
  },
  {
    id: "w_open_15", scope: "weekly",
    title: "Hoard Breaker", description: "Open 15 chests this week.",
    metric: "chests_opened", metricKind: "sum", target: 15,
    reward: { kind: "chest", chestType: "iron", qty: 1 },
  },
  {
    id: "w_trib_1", scope: "weekly",
    title: "Survive the Tribulation", description: "Complete a successful tribulation.",
    metric: "tribulation_succeeded", metricKind: "sum", target: 1,
    reward: { kind: "chest", chestType: "immortal", qty: 1 },
  },
];

const ALL_QUESTS: QuestDef[] = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
const QUEST_BY_ID = new Map(ALL_QUESTS.map((q) => [q.id, q]));
const QUESTS_BY_METRIC = new Map<string, QuestDef[]>();
for (const q of ALL_QUESTS) {
  const arr = QUESTS_BY_METRIC.get(q.metric) ?? [];
  arr.push(q);
  QUESTS_BY_METRIC.set(q.metric, arr);
}

const ROLL_COUNT_DAILY = 3;
const ROLL_COUNT_WEEKLY = 3;

// ── Period keys (UTC) ────────────────────────────────────────────────────────
// We use UTC so a player's day boundary is consistent regardless of where
// they're writing from (most quests are sprint-based and sprints are
// already timed in UTC on the server).

export function dailyKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function weeklyKey(now: Date = new Date()): string {
  // ISO week (YYYY-Www). Standard algorithm:
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function periodKeyFor(scope: QuestScope, now: Date = new Date()): string {
  return scope === "daily" ? dailyKey(now) : weeklyKey(now);
}

// ── Rolling new quests ───────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function ensureRolledForScope(
  client: PoolClient,
  userId: string,
  scope: QuestScope,
  now: Date,
): Promise<void> {
  const periodKey = periodKeyFor(scope, now);
  // Serialize per (user, scope) using a transaction-scoped advisory lock so
  // concurrent requests can't both decide "no rows yet" and double-roll.
  // The lock is automatically released at COMMIT/ROLLBACK.
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`quest_roll:${userId}:${scope}:${periodKey}`],
    );
    const { rows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_quests
       WHERE user_id = $1 AND scope = $2 AND period_key = $3`,
      [userId, scope, periodKey],
    );
    if (Number(rows[0]?.count ?? "0") > 0) {
      await client.query("COMMIT");
      return;
    }

    const defs = scope === "daily" ? DAILY_QUESTS : WEEKLY_QUESTS;
    const wanted = scope === "daily" ? ROLL_COUNT_DAILY : ROLL_COUNT_WEEKLY;
    const picks = shuffle(defs).slice(0, Math.min(wanted, defs.length));
    for (const q of picks) {
      await client.query(
        `INSERT INTO user_quests (user_id, quest_id, scope, period_key, target, progress)
         VALUES ($1, $2, $3, $4, $5, 0)
         ON CONFLICT (user_id, quest_id, period_key) DO NOTHING`,
        [userId, q.id, scope, periodKey, q.target],
      );
    }
    await client.query("COMMIT");
    logger.info({ userId, scope, periodKey, picks: picks.map((q) => q.id) }, "Rolled quests");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

// Opportunistic cleanup: delete this user's quest rows from periods older
// than ~30 days so the table doesn't grow unbounded. Cheap & best-effort.
async function pruneOldUserQuests(client: PoolClient, userId: string): Promise<void> {
  try {
    await client.query(
      `DELETE FROM user_quests
       WHERE user_id = $1 AND created_at < NOW() - INTERVAL '30 days'`,
      [userId],
    );
  } catch { /* non-fatal */ }
}

export async function ensureUserQuestsRolled(userId: string, now: Date = new Date()): Promise<void> {
  if (!userId) return;
  const client = await pool.connect();
  try {
    await ensureRolledForScope(client, userId, "daily", now);
    await ensureRolledForScope(client, userId, "weekly", now);
    await pruneOldUserQuests(client, userId);
  } finally {
    client.release();
  }
}

// ── Listing ──────────────────────────────────────────────────────────────────

export interface UserQuestRow {
  id: string;          // quest_id (string definition id)
  scope: QuestScope;
  title: string;
  description: string;
  target: number;
  progress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  reward: QuestReward;
  resetsAt: string;    // ISO timestamp when the period rolls over
}

function nextDailyResetIso(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return d.toISOString();
}
function nextWeeklyResetIso(now: Date = new Date()): string {
  // Next ISO Monday 00:00 UTC.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() + (8 - day));
  return d.toISOString();
}

export async function listUserQuests(userId: string, now: Date = new Date()): Promise<UserQuestRow[]> {
  await ensureUserQuestsRolled(userId, now);
  const dKey = dailyKey(now);
  const wKey = weeklyKey(now);
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      quest_id: string;
      scope: string;
      progress: number;
      target: number;
      claimed_at: Date | null;
    }>(
      `SELECT quest_id, scope, progress, target, claimed_at
       FROM user_quests
       WHERE user_id = $1 AND (
         (scope = 'daily'  AND period_key = $2) OR
         (scope = 'weekly' AND period_key = $3)
       )
       ORDER BY scope, quest_id`,
      [userId, dKey, wKey],
    );
    const dailyReset = nextDailyResetIso(now);
    const weeklyReset = nextWeeklyResetIso(now);
    return rows
      .map((r) => {
        const def = QUEST_BY_ID.get(r.quest_id);
        if (!def) return null;
        return {
          id: r.quest_id,
          scope: def.scope,
          title: def.title,
          description: def.description,
          target: r.target,
          progress: Math.min(r.progress, r.target),
          isCompleted: r.progress >= r.target,
          isClaimed: r.claimed_at !== null,
          reward: def.reward,
          resetsAt: def.scope === "daily" ? dailyReset : weeklyReset,
        };
      })
      .filter((x): x is UserQuestRow => x !== null);
  } finally {
    client.release();
  }
}

// ── Progress updates ─────────────────────────────────────────────────────────

/**
 * Increment progress for any active quest in the user's current period that
 * tracks the given metric. Safe to call from anywhere; never throws.
 *
 * For metricKind="max", we use GREATEST instead of progress + amount.
 */
export async function bumpQuests(
  userId: string,
  metric: string,
  amount: number,
  existingClient?: PoolClient,
): Promise<void> {
  if (!userId || !amount || amount <= 0) return;
  const defs = QUESTS_BY_METRIC.get(metric);
  if (!defs?.length) return;
  const dKey = dailyKey();
  const wKey = weeklyKey();
  try {
    // Always acquire a fresh client for the rolling step (it does BEGIN/COMMIT
    // and would conflict with an existingClient already inside a transaction).
    await ensureUserQuestsRolled(userId);
    const sumDefs = defs.filter((d) => d.metricKind === "sum").map((d) => d.id);
    const maxDefs = defs.filter((d) => d.metricKind === "max").map((d) => d.id);
    const run = async (client: PoolClient): Promise<void> => {
      if (sumDefs.length) {
        await client.query(
          `UPDATE user_quests
           SET progress = LEAST(target, progress + $1), updated_at = NOW()
           WHERE user_id = $2
             AND quest_id = ANY($3::text[])
             AND claimed_at IS NULL
             AND ((scope = 'daily'  AND period_key = $4) OR
                  (scope = 'weekly' AND period_key = $5))`,
          [amount, userId, sumDefs, dKey, wKey],
        );
      }
      if (maxDefs.length) {
        await client.query(
          `UPDATE user_quests
           SET progress = LEAST(target, GREATEST(progress, $1)), updated_at = NOW()
           WHERE user_id = $2
             AND quest_id = ANY($3::text[])
             AND claimed_at IS NULL
             AND ((scope = 'daily'  AND period_key = $4) OR
                  (scope = 'weekly' AND period_key = $5))`,
          [amount, userId, maxDefs, dKey, wKey],
        );
      }
    };
    if (existingClient) {
      await run(existingClient);
    } else {
      const client = await pool.connect();
      try { await run(client); } finally { client.release(); }
    }
  } catch (err) {
    logger.warn({ err, userId, metric, amount }, "bumpQuests failed (non-fatal)");
  }
}

// ── Claim ────────────────────────────────────────────────────────────────────

export interface ClaimResult {
  ok: true;
  reward: QuestReward;
  newCoinBalance?: number;
  newXp?: number;
}

export async function claimQuest(userId: string, questId: string, now: Date = new Date()): Promise<
  | ClaimResult
  | { ok: false; error: string; status: number }
> {
  const def = QUEST_BY_ID.get(questId);
  if (!def) return { ok: false, error: "Unknown quest", status: 404 };
  const periodKey = periodKeyFor(def.scope, now);
  const reward = def.reward;
  const result: ClaimResult = { ok: true, reward };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Atomic claim: only succeeds if completed and not already claimed.
    const { rows } = await client.query<{ id: number }>(
      `UPDATE user_quests
       SET claimed_at = NOW()
       WHERE user_id = $1
         AND quest_id = $2
         AND period_key = $3
         AND progress >= target
         AND claimed_at IS NULL
       RETURNING id`,
      [userId, questId, periodKey],
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      // Distinguish "already claimed" vs "not yet completed" for a nicer UX.
      const { rows: existing } = await client.query<{ progress: number; target: number; claimed_at: Date | null }>(
        `SELECT progress, target, claimed_at FROM user_quests
         WHERE user_id = $1 AND quest_id = $2 AND period_key = $3`,
        [userId, questId, periodKey],
      );
      const r = existing[0];
      if (!r) return { ok: false, error: "Quest not active for this period", status: 404 };
      if (r.claimed_at) return { ok: false, error: "Already claimed", status: 409 };
      return { ok: false, error: "Quest not yet completed", status: 400 };
    }

    // Grant the reward inline on the same client/transaction so a failure
    // here rolls back the claim and the player can try again.
    if (reward.kind === "chest") {
      await client.query(
        `INSERT INTO user_chests (user_id, chest_type, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, chest_type)
         DO UPDATE SET quantity = user_chests.quantity + $3, earned_at = NOW()`,
        [userId, reward.chestType, reward.qty],
      );
    } else if (reward.kind === "xp") {
      const { rows: xpRows } = await client.query<{ xp: number }>(
        `UPDATE user_profiles
         SET xp = xp + $1, updated_at = NOW()
         WHERE clerk_user_id = $2
         RETURNING xp`,
        [reward.amount, userId],
      );
      result.newXp = xpRows[0]?.xp;
    } else if (reward.kind === "coins") {
      await ensureUserCoins(client, userId);
      await dailyResetCheck(client, userId);
      const credit = await creditCoins(
        client, userId, reward.amount, "quest_reward", questId, `Quest: ${def.title}`,
      );
      result.newCoinBalance = credit.newBalance;
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err, userId, questId }, "Quest claim failed; rolled back");
    return { ok: false, error: "Claim failed; please retry", status: 500 };
  } finally {
    client.release();
  }
}

// ── Bag-style summary for clients ────────────────────────────────────────────

export function describeReward(r: QuestReward): string {
  if (r.kind === "chest") {
    const label = r.chestType.charAt(0).toUpperCase() + r.chestType.slice(1);
    return r.qty > 1 ? `${r.qty}× ${label} Chest` : `${label} Chest`;
  }
  if (r.kind === "coins") return `${r.amount} Spirit Coins`;
  return `${r.amount} XP`;
}
