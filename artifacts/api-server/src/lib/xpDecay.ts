import { pool } from "@workspace/db";
import { logger } from "./logger";

// ── Constants shared with the /user/profile route ──────────────────────────

// Rank thresholds (index → min XP)
export const RANK_THRESHOLDS = [0, 500, 2000, 7000, 20000, 60000, 175000, 450000];

// XP lost per day after the grace period, indexed by rank.
// Ranks 0–2 (below Author) never decay.
export const DECAY_RATE_PER_DAY = [0, 0, 0, 25, 75, 200, 500, 1000];

export const DECAY_GRACE_DAYS = 5;

export function getRankIndex(xp: number): number {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i]) return i;
  }
  return 0;
}

// ── Single-query batch decay ───────────────────────────────────────────────
//
// Why one query instead of per-user SELECT + UPDATE:
//
// The old approach (1 findUsersNeedingDecay SELECT + 2 pool.query() calls per
// user) caused a cascade under DB degradation: if the UPDATE for user N timed
// out, pg-pool destroyed that connection (release-with-error). The next user's
// pool.query() had to open a NEW TCP connection. If the DB was still slow,
// that new connection hung in auth → auth-phase zombie (active↑, tracked=0).
// With M users in a scan, M consecutive failures → M zombies → watchdog exit.
//
// The single-query approach below borrows exactly one connection for the
// entire scan. All candidate selection, decay calculation, and UPDATE happen
// inside one SQL CTE. If the query fails, one connection is destroyed (or
// returned cleanly). No cascade is possible.
//
// Rank thresholds and decay rates are inlined as SQL CASE expressions so the
// JS constants stay the single source of truth for everything else (profile
// display, XP award routes), while the decay scan needs no round-trips.

interface BatchDecayRow {
  clerk_user_id: string;
  old_xp: number;
  new_xp: number;
  decay_days: number;
}

async function runBatchDecay(): Promise<BatchDecayRow[]> {
  // Rank index thresholds: [0,500,2000,7000,20000,60000,175000,450000]
  // Decay rate per day:    [0,  0,   0,  25,   75,  200,   500, 1000]
  // Grace period: 5 days. Only ranks 3+ (xp >= 7000) ever decay.
  //
  // chargeFrom = GREATEST(last_sprint_at + 5 days, decay_checked_at)
  // decayDays  = FLOOR((NOW() - chargeFrom) / 1 day), clamped to > 0
  // newXp      = GREATEST(0, xp - decayDays * ratePerDay)
  //
  // Candidates already filtered to xp >= 7000, so rankIndex < 3 is impossible.
  const result = await pool.query<BatchDecayRow>(`
    WITH candidates AS (
      SELECT
        clerk_user_id,
        xp,
        CASE
          WHEN xp >= 450000 THEN 1000
          WHEN xp >= 175000 THEN 500
          WHEN xp >= 60000  THEN 200
          WHEN xp >= 20000  THEN 75
          ELSE                   25
        END AS decay_rate,
        GREATEST(
          last_sprint_at + INTERVAL '5 days',
          COALESCE(decay_checked_at, '-infinity'::timestamptz)
        ) AS charge_from
      FROM user_profiles
      WHERE last_sprint_at IS NOT NULL
        AND xp >= 7000
        AND last_sprint_at < NOW() - INTERVAL '5 days'
        AND (decay_checked_at IS NULL
             OR decay_checked_at < NOW() - INTERVAL '1 day')
      ORDER BY decay_checked_at ASC NULLS FIRST
      LIMIT 500
    ),
    eligible AS (
      SELECT *,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - charge_from)) / 86400)::int AS decay_days
      FROM candidates
      WHERE NOW() > charge_from
    )
    UPDATE user_profiles AS up
       SET xp              = GREATEST(0, e.xp - e.decay_days * e.decay_rate),
           decay_checked_at = NOW(),
           updated_at       = NOW()
      FROM eligible e
     WHERE up.clerk_user_id = e.clerk_user_id
       AND e.decay_days > 0
    RETURNING
      up.clerk_user_id,
      e.xp        AS old_xp,
      up.xp       AS new_xp,
      e.decay_days
  `);
  return result.rows;
}

// ── Background scheduler ───────────────────────────────────────────────────
// Runs every DECAY_SCAN_INTERVAL_MS. The entire scan is a single SQL
// statement — one connection borrowed and released, no per-user round-trips.

const DECAY_SCAN_INTERVAL_MS = 5 * 60_000;    // every 5 minutes
let scanTimer: ReturnType<typeof setInterval> | null = null;
let scanRunning = false;

async function runScan(): Promise<void> {
  if (scanRunning) return;
  scanRunning = true;

  const startedAt = Date.now();
  try {
    const rows = await runBatchDecay();
    logger.info(
      { decayed: rows.length, ms: Date.now() - startedAt },
      "[xpDecay] scan complete",
    );
    for (const r of rows) {
      logger.info(
        { clerkUserId: r.clerk_user_id, oldXp: r.old_xp, newXp: r.new_xp, decayDays: r.decay_days },
        "[xpDecay] applied decay",
      );
    }
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[xpDecay] scan failed");
  } finally {
    scanRunning = false;
  }
}

export function startXpDecayScheduler(): void {
  if (scanTimer) return;
  // Fire one scan ~30 s after boot so a slow DB cold-start doesn't block
  // server readiness, then every DECAY_SCAN_INTERVAL_MS thereafter.
  setTimeout(() => { void runScan(); }, 30_000);
  scanTimer = setInterval(() => { void runScan(); }, DECAY_SCAN_INTERVAL_MS);
  logger.info(
    { intervalMs: DECAY_SCAN_INTERVAL_MS },
    "[xpDecay] background scheduler started",
  );
}

export function stopXpDecayScheduler(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}
