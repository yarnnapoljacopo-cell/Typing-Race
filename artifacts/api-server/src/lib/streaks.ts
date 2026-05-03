import type { PoolClient } from "pg";
import { pool } from "@workspace/db";

// ── Daily-streak chest reward configuration ──────────────────────────────
// Every NEW writing day grants one low-tier "mortal" chest. Every 7th day
// of the streak (7, 14, 21, …) additionally rolls for a bonus high-tier
// chest. The bonus is intentionally rare — most milestones grant nothing
// extra, and immortal chests are practically a lottery.
const DAILY_BASE_CHEST = "mortal";
const STREAK_MILESTONE_DAYS = 7;

// Sums to 100. ~90% of milestone rolls grant nothing extra — the bonus is
// intentionally a *long-shot*, not an expectation. Distribution favours iron
// among the rare wins; immortal is essentially a lottery (~1 in 1000 rolls).
const STREAK_BONUS_TABLE: Array<{ chest: string | null; weight: number }> = [
  { chest: null,       weight: 90 },   // 90% — no extra chest
  { chest: "iron",     weight:  7 },   // 7%
  { chest: "crystal",  weight:  2.5 }, // 2.5%
  { chest: "inferno",  weight:  0.4 }, // 0.4%
  { chest: "immortal", weight:  0.1 }, // 0.1% — practically a lottery
];

function rollStreakBonus(): string | null {
  const total = STREAK_BONUS_TABLE.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const entry of STREAK_BONUS_TABLE) {
    r -= entry.weight;
    if (r <= 0) return entry.chest;
  }
  return null;
}

async function insertChest(
  client: PoolClient,
  userId: string,
  chestType: string,
): Promise<void> {
  await client.query(
    `INSERT INTO user_chests (user_id, chest_type, quantity)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, chest_type)
     DO UPDATE SET quantity = user_chests.quantity + 1, earned_at = NOW()`,
    [userId, chestType],
  );
}

export interface DailyChestAward {
  base: string | null;       // chest awarded for showing up today (or null if already counted)
  bonus: string | null;      // milestone bonus (null if no roll or roll lost)
  streakDay: number;         // the streak day after this write
  isNewDay: boolean;         // false when the user already wrote today
}

export function dayKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dayKey(dt);
}

/**
 * Records that the user wrote today: bumps the daily_writing_log row and
 * recomputes current_streak / longest_streak on user_profiles.
 *
 * Best-effort — never throws.
 */
export async function recordWritingDay(
  userId: string,
  wordsWritten: number,
  sprintsCompleted: number,
): Promise<DailyChestAward> {
  const empty: DailyChestAward = { base: null, bonus: null, streakDay: 0, isNewDay: false };
  if (!userId) return empty;
  const client = await pool.connect();
  try {
    const today = dayKey();

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO daily_writing_log (user_id, day_key, words_written, sprints_completed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, day_key) DO UPDATE SET
         words_written     = daily_writing_log.words_written + EXCLUDED.words_written,
         sprints_completed = daily_writing_log.sprints_completed + EXCLUDED.sprints_completed,
         updated_at        = NOW()`,
      [userId, today, wordsWritten, sprintsCompleted],
    );

    const { rows } = await client.query<{
      current_streak: number;
      longest_streak: number;
      last_streak_day: string | null;
    }>(
      `SELECT current_streak, longest_streak, last_streak_day
       FROM user_profiles WHERE clerk_user_id = $1
       FOR UPDATE`,
      [userId],
    );
    if (rows.length === 0) {
      await client.query("COMMIT");
      return empty;
    }
    const { current_streak, longest_streak, last_streak_day } = rows[0];

    let newStreak: number;
    const isNewDay = last_streak_day !== today;
    if (last_streak_day === today) {
      newStreak = current_streak; // already counted today
    } else if (last_streak_day && addDays(last_streak_day, 1) === today) {
      newStreak = current_streak + 1; // consecutive
    } else {
      newStreak = 1; // first day or gap
    }
    const newLongest = Math.max(longest_streak, newStreak);

    await client.query(
      `UPDATE user_profiles
       SET current_streak = $1, longest_streak = $2, last_streak_day = $3, updated_at = NOW()
       WHERE clerk_user_id = $4`,
      [newStreak, newLongest, today, userId],
    );

    // ── Daily chest reward (only on first sprint of a new day) ──────────
    let baseChest: string | null = null;
    let bonusChest: string | null = null;
    if (isNewDay) {
      baseChest = DAILY_BASE_CHEST;
      await insertChest(client, userId, baseChest);

      // Every 7th day of the streak: roll for a low-chance bonus chest.
      if (newStreak > 0 && newStreak % STREAK_MILESTONE_DAYS === 0) {
        bonusChest = rollStreakBonus();
        if (bonusChest) {
          await insertChest(client, userId, bonusChest);
        }
      }
    }

    await client.query("COMMIT");
    return { base: baseChest, bonus: bonusChest, streakDay: newStreak, isNewDay };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    // Best-effort — caller logs.
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns the current streak with one-day grace: if the user wrote yesterday
 * but not yet today, today still counts as "active". If the gap is bigger,
 * the displayed streak is 0.
 */
export function effectiveStreak(currentStreak: number, lastStreakDay: string | null): number {
  if (!lastStreakDay) return 0;
  const today = dayKey();
  if (lastStreakDay === today) return currentStreak;
  if (addDays(lastStreakDay, 1) === today) return currentStreak; // wrote yesterday
  return 0;
}
