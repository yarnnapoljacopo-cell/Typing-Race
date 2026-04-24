import type { PoolClient } from "pg";

const DAILY_EARN_CAP = 80;

/**
 * Ensures a user_coins row exists for this user, creating it if needed.
 * Returns the current row (after creation).
 */
export async function ensureUserCoins(
  client: PoolClient,
  userId: string,
): Promise<{ balance: number; daily_coins_earned: number; daily_reset_at: Date }> {
  await client.query(
    `INSERT INTO user_coins (user_id, balance, daily_coins_earned, daily_reset_at, updated_at)
     VALUES ($1, 0, 0, NOW(), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const { rows } = await client.query(
    `SELECT balance, daily_coins_earned, daily_reset_at FROM user_coins WHERE user_id = $1`,
    [userId],
  );
  return rows[0] as { balance: number; daily_coins_earned: number; daily_reset_at: Date };
}

/**
 * Runs the daily reset check — if more than 24 hours have passed since
 * daily_reset_at, zeroes out daily_coins_earned and updates daily_reset_at.
 * Must be called inside a transaction or directly (client already acquired).
 */
export async function dailyResetCheck(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `UPDATE user_coins
     SET daily_coins_earned = 0,
         daily_reset_at     = NOW(),
         updated_at         = NOW()
     WHERE user_id = $1
       AND NOW() > daily_reset_at + INTERVAL '24 hours'`,
    [userId],
  );
}

/**
 * Credits coins to a user, respecting the 80-coin daily earn cap.
 * Inserts a coin_transactions row and updates the user_coins balance.
 * Only chest_drop and item_sale count toward the daily cap.
 * Shop purchases are deductions and bypass the cap entirely.
 *
 * Returns { credited, newBalance, dailyEarned }.
 */
export async function creditCoins(
  client: PoolClient,
  userId: string,
  amount: number,
  type: "chest_drop" | "item_sale",
  referenceId: string | null,
  description: string,
): Promise<{ credited: number; newBalance: number; dailyEarned: number }> {
  await ensureUserCoins(client, userId);
  await dailyResetCheck(client, userId);

  const { rows } = await client.query(
    `SELECT balance, daily_coins_earned FROM user_coins WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  const { balance, daily_coins_earned } = rows[0] as {
    balance: number;
    daily_coins_earned: number;
  };

  const remaining = DAILY_EARN_CAP - daily_coins_earned;
  const credited = Math.max(0, Math.min(amount, remaining));

  if (credited > 0) {
    await client.query(
      `INSERT INTO coin_transactions (user_id, amount, transaction_type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, credited, type, referenceId, description],
    );
    const { rows: updated } = await client.query(
      `UPDATE user_coins
       SET balance            = balance + $1,
           daily_coins_earned = daily_coins_earned + $1,
           updated_at         = NOW()
       WHERE user_id = $2
       RETURNING balance, daily_coins_earned`,
      [credited, userId],
    );
    const upd = updated[0] as { balance: number; daily_coins_earned: number };
    return { credited, newBalance: upd.balance, dailyEarned: upd.daily_coins_earned };
  }

  return { credited: 0, newBalance: balance, dailyEarned: daily_coins_earned };
}

/**
 * Deducts coins from a user for a shop purchase.
 * Validates balance is sufficient and inserts a transaction record.
 * Returns { newBalance }.
 */
export async function deductCoins(
  client: PoolClient,
  userId: string,
  amount: number,
  referenceId: string,
  description: string,
): Promise<{ newBalance: number }> {
  await ensureUserCoins(client, userId);

  const { rows } = await client.query(
    `SELECT balance FROM user_coins WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  const balance = (rows[0] as { balance: number }).balance;
  if (balance < amount) throw new Error("Insufficient Spirit Coins");

  await client.query(
    `INSERT INTO coin_transactions (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, $2, 'shop_purchase', $3, $4)`,
    [userId, -amount, referenceId, description],
  );
  const { rows: updated } = await client.query(
    `UPDATE user_coins
     SET balance    = balance - $1,
         updated_at = NOW()
     WHERE user_id = $2
     RETURNING balance`,
    [amount, userId],
  );
  return { newBalance: (updated[0] as { balance: number }).balance };
}

export { DAILY_EARN_CAP };
