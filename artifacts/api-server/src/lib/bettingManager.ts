import { pool } from "@workspace/db";
import { logger } from "./logger";
import { ensureUserCoins } from "./coinHelper";

export class BetError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const MIN_BET = 1;
export const MAX_BET = 10_000;

export interface RoomLite {
  code: string;
  status: "waiting" | "countdown" | "running" | "finished";
}

export interface BetSummary {
  totalPot: number;
  bettorCount: number;
  myBet: number | null;
  myStatus: "active" | "won" | "lost" | "refunded" | null;
  myPayout: number | null;
  bettors: Array<{ writerName: string; amount: number }>;
  status: "open" | "closed" | "settled";
}

/**
 * Place (or top up) a bet for `userId` on room `code`. Atomically:
 *   1. validates room status (must be waiting or countdown)
 *   2. locks the user's coin row
 *   3. checks balance, deducts coins
 *   4. inserts a coin_transactions row (type='bet_placed')
 *   5. inserts/updates room_bets row (PK = room_code,user_id)
 */
export async function placeBet(
  room: RoomLite,
  userId: string,
  writerName: string,
  amount: number,
  /** Re-checked inside the transaction to close the status-check → commit race. */
  getCurrentStatus: () => RoomLite["status"] | undefined,
): Promise<{ newBalance: number; totalBet: number }> {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new BetError("Bet must be a whole number");
  }
  if (amount < MIN_BET) throw new BetError(`Minimum bet is ${MIN_BET} coin`);
  if (amount > MAX_BET) throw new BetError(`Maximum bet is ${MAX_BET} coins`);
  if (room.status !== "waiting" && room.status !== "countdown") {
    throw new BetError("Betting is closed for this sprint", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Re-check status *after* BEGIN to close the race window: if the sprint
    // transitioned to "running"/"finished" between the route-level check and
    // here, abort instead of committing a late bet.
    const liveStatus = getCurrentStatus();
    if (liveStatus !== "waiting" && liveStatus !== "countdown") {
      throw new BetError("Betting is closed for this sprint", 409);
    }
    await ensureUserCoins(client, userId);

    const { rows: balRows } = await client.query(
      `SELECT balance FROM user_coins WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const balance = (balRows[0] as { balance: number }).balance;
    if (balance < amount) {
      throw new BetError("Not enough Spirit Coins", 409);
    }

    await client.query(
      `INSERT INTO coin_transactions (user_id, amount, transaction_type, reference_id, description)
       VALUES ($1, $2, 'bet_placed', $3, $4)`,
      [userId, -amount, room.code, `Sprint bet on ${room.code}`],
    );

    const { rows: updated } = await client.query(
      `UPDATE user_coins
       SET balance = balance - $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING balance`,
      [amount, userId],
    );
    const newBalance = (updated[0] as { balance: number }).balance;

    // Upsert: if user already bet, increase their stake.
    const { rows: betRows } = await client.query(
      `INSERT INTO room_bets (room_code, user_id, writer_name, amount, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (room_code, user_id)
       DO UPDATE SET amount = room_bets.amount + EXCLUDED.amount,
                     writer_name = EXCLUDED.writer_name,
                     status = 'active'
       RETURNING amount`,
      [room.code, userId, writerName, amount],
    );
    const totalBet = (betRows[0] as { amount: number }).amount;

    await client.query("COMMIT");
    return { newBalance, totalBet };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Read the current bet summary for a room.
 * `myUserId` returns the current viewer's stake (or null).
 */
export async function getBetSummary(
  roomCode: string,
  myUserId: string | null,
): Promise<BetSummary> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT user_id, writer_name, amount, status
         FROM room_bets
        WHERE room_code = $1`,
      [roomCode],
    );
    const typed = rows as Array<{
      user_id: string; writer_name: string; amount: number; status: string;
    }>;
    const allActive = typed.filter((r) => r.status === "active");
    const totalPot = allActive.reduce((s, r) => s + r.amount, 0);

    // My row may exist in any status (active during waiting, settled after end).
    const myRow = myUserId ? typed.find((r) => r.user_id === myUserId) : undefined;
    const myBet = myRow?.amount ?? null;
    const myStatus = (myRow?.status as BetSummary["myStatus"]) ?? null;

    // myPayout: pot if I won, my stake if refunded, 0 if lost, null if no bet/unsettled
    let myPayout: number | null = null;
    if (myRow) {
      if (myRow.status === "won") {
        // pot = sum of every bet in the room (winners + losers all contribute)
        myPayout = typed.reduce((s, r) => s + r.amount, 0);
      } else if (myRow.status === "refunded") {
        myPayout = myRow.amount;
      } else if (myRow.status === "lost") {
        myPayout = 0;
      }
    }

    const settledAny = typed.some((r) => r.status === "won" || r.status === "lost" || r.status === "refunded");
    const status: BetSummary["status"] = settledAny ? "settled" : "open";
    return {
      totalPot,
      bettorCount: allActive.length,
      myBet,
      myStatus,
      myPayout,
      bettors: allActive.map((r) => ({ writerName: r.writer_name, amount: r.amount })),
      status,
    };
  } finally {
    client.release();
  }
}

/**
 * Settle bets at sprint end.
 *  - winnerName: the participant with the highest score (or null if tie/no participants)
 *  - If no bets exist → no-op.
 *  - If exactly one bettor → refund them.
 *  - If winner placed a bet → that user gets the entire pot, others marked 'lost'.
 *  - If winner did NOT place a bet → all bets refunded.
 *
 * Returns a per-userId outcome map so the caller can notify clients.
 */
export interface BetOutcome {
  userId: string;
  writerName: string;
  amount: number;
  outcome: "won" | "lost" | "refunded";
  payout: number;
}

export async function settleBets(
  roomCode: string,
  /**
   * Winner identified by Clerk user id (NOT writer name).
   * Name-matching could let a non-participant with the same writer name
   * receive the pot, so identity must be enforced.
   */
  winnerUserId: string | null,
): Promise<BetOutcome[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: betRows } = await client.query(
      `SELECT user_id, writer_name, amount
         FROM room_bets
        WHERE room_code = $1 AND status = 'active'
        FOR UPDATE`,
      [roomCode],
    );
    if (betRows.length === 0) {
      await client.query("COMMIT");
      return [];
    }

    const bets = betRows as Array<{ user_id: string; writer_name: string; amount: number }>;
    const pot = bets.reduce((s, b) => s + b.amount, 0);
    const winner = winnerUserId ? bets.find((b) => b.user_id === winnerUserId) : undefined;
    const refundAll = bets.length < 2 || !winner;

    const outcomes: BetOutcome[] = [];

    if (refundAll) {
      for (const b of bets) {
        await refundOne(client, roomCode, b.user_id, b.amount, "Sprint bet refunded");
        outcomes.push({
          userId: b.user_id,
          writerName: b.writer_name,
          amount: b.amount,
          outcome: "refunded",
          payout: b.amount,
        });
      }
    } else {
      for (const b of bets) {
        if (b.user_id === winner.user_id) {
          await client.query(
            `INSERT INTO coin_transactions (user_id, amount, transaction_type, reference_id, description)
             VALUES ($1, $2, 'bet_payout', $3, $4)`,
            [b.user_id, pot, roomCode, `Sprint bet payout — won pot of ${pot}`],
          );
          await client.query(
            `UPDATE user_coins SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
            [pot, b.user_id],
          );
          await client.query(
            `UPDATE room_bets SET status = 'won', settled_at = NOW()
              WHERE room_code = $1 AND user_id = $2`,
            [roomCode, b.user_id],
          );
          outcomes.push({
            userId: b.user_id,
            writerName: b.writer_name,
            amount: b.amount,
            outcome: "won",
            payout: pot,
          });
        } else {
          await client.query(
            `UPDATE room_bets SET status = 'lost', settled_at = NOW()
              WHERE room_code = $1 AND user_id = $2`,
            [roomCode, b.user_id],
          );
          outcomes.push({
            userId: b.user_id,
            writerName: b.writer_name,
            amount: b.amount,
            outcome: "lost",
            payout: 0,
          });
        }
      }
    }

    await client.query("COMMIT");
    logger.info({ roomCode, winnerUserId, pot, count: bets.length }, "Bets settled");
    return outcomes;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error({ err, roomCode }, "Failed to settle bets");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Refund every still-active bet on a room (used when the room is canceled
 * or auto-cleaned without ever finishing a sprint normally).
 */
export async function refundActiveBets(roomCode: string, reason = "Sprint bet refunded"): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT user_id, amount FROM room_bets
        WHERE room_code = $1 AND status = 'active' FOR UPDATE`,
      [roomCode],
    );
    let refunded = 0;
    for (const b of rows as Array<{ user_id: string; amount: number }>) {
      await refundOne(client, roomCode, b.user_id, b.amount, reason);
      refunded++;
    }
    await client.query("COMMIT");
    if (refunded > 0) {
      logger.info({ roomCode, refunded }, "Refunded active bets");
    }
    return refunded;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error({ err, roomCode }, "Failed to refund bets");
    return 0;
  } finally {
    client.release();
  }
}

async function refundOne(
  // pg PoolClient — typed as `any` here so we don't drag the pg types into
  // every consumer of this helper.
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  roomCode: string,
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  await client.query(
    `INSERT INTO coin_transactions (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, $2, 'bet_refund', $3, $4)`,
    [userId, amount, roomCode, description],
  );
  await client.query(
    `UPDATE user_coins SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
    [amount, userId],
  );
  await client.query(
    `UPDATE room_bets SET status = 'refunded', settled_at = NOW()
      WHERE room_code = $1 AND user_id = $2`,
    [roomCode, userId],
  );
}
