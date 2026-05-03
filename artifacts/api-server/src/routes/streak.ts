import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { effectiveStreak } from "../lib/streaks";

const router: IRouter = Router();

function isValidMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

router.get("/user/streak", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const monthRaw = String(req.query.month ?? "");
  const now = new Date();
  const defaultMonth =
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const month = monthRaw && isValidMonth(monthRaw) ? monthRaw : defaultMonth;

  const client = await pool.connect();
  try {
    const profile = await client.query<{
      current_streak: number;
      longest_streak: number;
      last_streak_day: string | null;
    }>(
      `SELECT current_streak, longest_streak, last_streak_day
       FROM user_profiles WHERE clerk_user_id = $1`,
      [userId],
    );
    const cs = profile.rows[0]?.current_streak ?? 0;
    const ls = profile.rows[0]?.longest_streak ?? 0;
    const lsDay = profile.rows[0]?.last_streak_day ?? null;

    const monthStart = `${month}-01`;
    // Compute next month's first day for an exclusive upper bound
    const [y, m] = month.split("-").map(Number);
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const monthEnd = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

    const days = await client.query<{
      day_key: string;
      words_written: number;
      sprints_completed: number;
    }>(
      `SELECT day_key, words_written, sprints_completed
       FROM daily_writing_log
       WHERE user_id = $1 AND day_key >= $2 AND day_key < $3
       ORDER BY day_key ASC`,
      [userId, monthStart, monthEnd],
    );

    res.json({
      month,
      currentStreak: effectiveStreak(cs, lsDay),
      longestStreak: ls,
      lastStreakDay: lsDay,
      days: days.rows.map((r) => ({
        day: r.day_key,
        wordsWritten: r.words_written,
        sprintsCompleted: r.sprints_completed,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GET /user/streak failed");
    res.status(500).json({ error: "Internal error" });
  } finally {
    client.release();
  }
});

export default router;
