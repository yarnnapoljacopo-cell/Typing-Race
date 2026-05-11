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

// ── Decay execution ────────────────────────────────────────────────────────

interface DecayResult {
  xpLost: number;
  newXp: number;
}

const DECAY_QUERY_TIMEOUT_MS = 3_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} exceeded ${ms}ms — aborting to free pool slot`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function runDecayDb(clerkUserId: string): Promise<DecayResult | null> {
  const client = await pool.connect();
  let txOpen = false;
  try {
    await client.query("BEGIN");
    txOpen = true;
    await client.query(`SET LOCAL statement_timeout = ${DECAY_QUERY_TIMEOUT_MS}`);

    const rows = await client.query<{
      xp: number;
      last_sprint_at: Date | null;
      decay_checked_at: Date | null;
    }>(
      `SELECT xp, last_sprint_at, decay_checked_at
         FROM user_profiles
        WHERE clerk_user_id = $1
        LIMIT 1`,
      [clerkUserId],
    );

    if (rows.rows.length === 0) {
      await client.query("COMMIT");
      txOpen = false;
      return null;
    }
    const { xp, last_sprint_at: lastSprintAt, decay_checked_at: decayCheckedAt } = rows.rows[0];
    const now = new Date();

    if (!lastSprintAt) {
      await client.query("COMMIT");
      txOpen = false;
      return null;
    }

    const rankIndex = getRankIndex(xp);
    if (rankIndex < 3) {
      await client.query(
        `UPDATE user_profiles SET decay_checked_at = $1 WHERE clerk_user_id = $2`,
        [now, clerkUserId],
      );
      await client.query("COMMIT");
      txOpen = false;
      return null;
    }

    const decayWindowStart = new Date(lastSprintAt.getTime() + DECAY_GRACE_DAYS * 86_400_000);
    const chargeFrom =
      decayCheckedAt && decayCheckedAt > decayWindowStart ? decayCheckedAt : decayWindowStart;

    if (now <= chargeFrom) {
      await client.query("COMMIT");
      txOpen = false;
      return null;
    }

    const decayDays = Math.floor((now.getTime() - chargeFrom.getTime()) / 86_400_000);
    if (decayDays <= 0) {
      await client.query("COMMIT");
      txOpen = false;
      return null;
    }

    const decayPerDay = DECAY_RATE_PER_DAY[rankIndex];
    const totalDecay = decayDays * decayPerDay;
    const newXp = Math.max(0, xp - totalDecay);

    await client.query(
      `UPDATE user_profiles
          SET xp = $1, decay_checked_at = $2, updated_at = $2
        WHERE clerk_user_id = $3`,
      [newXp, now, clerkUserId],
    );
    await client.query("COMMIT");
    txOpen = false;

    return { xpLost: xp - newXp, newXp };
  } catch (err) {
    if (txOpen) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    client.release();
  }
}

// ── Per-user circuit breaker (still useful inside the scheduler) ──────────

const decayFailures = new Map<string, { count: number; openUntil: number }>();
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 60_000;

async function applyDecayForUser(clerkUserId: string): Promise<DecayResult | null> {
  const breaker = decayFailures.get(clerkUserId);
  if (breaker && breaker.count >= FAILURE_THRESHOLD && Date.now() < breaker.openUntil) {
    return null;
  }

  try {
    const result = await withTimeout(
      runDecayDb(clerkUserId),
      DECAY_QUERY_TIMEOUT_MS + 500,
      "applyDecayForUser",
    );
    decayFailures.delete(clerkUserId);
    return result;
  } catch (err) {
    const prev = decayFailures.get(clerkUserId) ?? { count: 0, openUntil: 0 };
    const count = prev.count + 1;
    const openUntil = count >= FAILURE_THRESHOLD ? Date.now() + CIRCUIT_OPEN_MS : 0;
    decayFailures.set(clerkUserId, { count, openUntil });
    if (count === FAILURE_THRESHOLD) {
      logger.warn(
        { clerkUserId, count, openMs: CIRCUIT_OPEN_MS, err: (err as Error).message },
        "[xpDecay] circuit OPEN — pausing decay for this user",
      );
    }
    throw err;
  }
}

// ── Background scheduler ───────────────────────────────────────────────────
// Runs every DECAY_SCAN_INTERVAL_MS, finds every user that *might* be due
// for decay, and processes them serially with a small inter-user delay so
// we never burst the pool. Completely decoupled from any HTTP request.

const DECAY_SCAN_INTERVAL_MS = 5 * 60_000;     // every 5 minutes
const INTER_USER_DELAY_MS = 100;               // tiny pause between users
let scanTimer: ReturnType<typeof setInterval> | null = null;
let scanRunning = false;

async function findUsersNeedingDecay(): Promise<string[]> {
  // We pre-filter at the DB level so the scheduler isn't iterating over the
  // entire user base every 5 minutes. A user is a candidate if:
  //   - they've ever sprinted (last_sprint_at IS NOT NULL)
  //   - they're at Author rank or above (xp >= RANK_THRESHOLDS[3])
  //   - they're past the grace window since their last sprint
  //   - they haven't been decay-checked in the last day (or never)
  //
  // Uses pool.query() (not pool.connect()) so the connection is automatically
  // returned to the idle pool after the query — no manual release needed.
  const minDecayXp = RANK_THRESHOLDS[3];
  const result = await pool.query<{ clerk_user_id: string }>(
    `SELECT clerk_user_id
       FROM user_profiles
      WHERE last_sprint_at IS NOT NULL
        AND xp >= $1
        AND last_sprint_at < NOW() - make_interval(days => $2)
        AND (decay_checked_at IS NULL
             OR decay_checked_at < NOW() - INTERVAL '1 day')
      ORDER BY decay_checked_at ASC NULLS FIRST
      LIMIT 500`,
    [minDecayXp, DECAY_GRACE_DAYS],
  );
  return result.rows.map((r) => r.clerk_user_id);
}

async function runScan(): Promise<void> {
  if (scanRunning) return;       // never overlap scans
  scanRunning = true;
  const startedAt = Date.now();
  let scanned = 0;
  let decayed = 0;
  let failed = 0;
  try {
    const users = await findUsersNeedingDecay();
    for (const uid of users) {
      // Stop processing if the pool is under pressure. withTimeout() lets us
      // move on to the next user while the previous pool.connect() is still
      // pending in the background — after several timeouts these accumulate as
      // zombie connections (active but never acquired). Bailing early prevents
      // that build-up and lets the pool recover before the next scan.
      const poolActive = pool.totalCount - pool.idleCount;
      if (poolActive >= 6) {
        logger.warn({ poolActive }, "[xpDecay] pool under pressure — stopping scan early");
        break;
      }
      scanned++;
      try {
        const r = await applyDecayForUser(uid);
        if (r && r.xpLost > 0) decayed++;
      } catch {
        failed++;
        // applyDecayForUser already logs / trips the breaker
      }
      // Yield between users so other DB callers can grab pool slots.
      if (INTER_USER_DELAY_MS > 0) {
        await new Promise((r) => setTimeout(r, INTER_USER_DELAY_MS));
      }
    }
    logger.info(
      { scanned, decayed, failed, ms: Date.now() - startedAt },
      "[xpDecay] scan complete",
    );
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
