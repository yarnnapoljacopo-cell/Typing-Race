import type { PoolClient } from "pg";
import { pool } from "@workspace/db";

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
): Promise<void> {
  if (!userId) return;
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
      return;
    }
    const { current_streak, longest_streak, last_streak_day } = rows[0];

    let newStreak: number;
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

    await client.query("COMMIT");
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
