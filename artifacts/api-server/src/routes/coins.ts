import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { ensureUserCoins, dailyResetCheck, creditCoins } from "../lib/coinHelper";

const router: IRouter = Router();

const DAILY_EARN_CAP = 80;

// ── GET /api/coins ────────────────────────────────────────────────────────────
// Returns balance, daily stats, and last 20 transactions.
// Triggers the daily reset check on every call.

router.get("/coins", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error("[coins] pool.connect failed:", (err as Error).message);
    res.status(503).json({ error: "Database temporarily unavailable, please try again." });
    return;
  }
  try {
    await ensureUserCoins(client, userId);
    await dailyResetCheck(client, userId);

    const { rows: coinRows } = await client.query(
      `SELECT balance, daily_coins_earned, daily_reset_at FROM user_coins WHERE user_id = $1`,
      [userId],
    );
    const coin = coinRows[0] as {
      balance: number;
      daily_coins_earned: number;
      daily_reset_at: Date;
    };

    const { rows: txRows } = await client.query(
      `SELECT id, amount, transaction_type, reference_id, description, created_at
       FROM coin_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId],
    );

    res.json({
      balance: coin.balance,
      last_20_transactions: txRows,
    });
  } finally {
    client.release();
  }
});

// ── POST /api/coins/sell ──────────────────────────────────────────────────────
// Sells one item from the user's bag.
// Body: { inventory_id: number }

router.post("/coins/sell", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { inventory_id } = req.body ?? {};
  if (!inventory_id) { res.status(400).json({ error: "inventory_id required" }); return; }

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error("[coins/sell] pool.connect failed:", (err as Error).message);
    res.status(503).json({ error: "Database temporarily unavailable, please try again." });
    return;
  }
  try {
    await client.query("BEGIN");

    // Step 1: Lock the inventory row
    const { rows: invRows } = await client.query(
      `SELECT ui.id, ui.item_id, ui.quantity,
              im.name, im.is_tradeable, im.sell_value, im.is_storage_item
       FROM user_inventory ui
       JOIN items_master im ON im.id = ui.item_id
       WHERE ui.id = $1 AND ui.user_id = $2
       FOR UPDATE`,
      [inventory_id, userId],
    );
    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Item not found in your bag" });
      return;
    }
    const inv = invRows[0] as {
      id: number; item_id: number; quantity: number;
      name: string; is_tradeable: boolean; sell_value: number; is_storage_item: boolean;
    };

    // Step 2: Check if currently equipped — only block if this is the LAST copy
    if (inv.is_storage_item) {
      const { rows: eqRows } = await client.query(
        `SELECT item_id FROM equipped_storage WHERE user_id = $1 AND item_id = $2`,
        [userId, inv.item_id],
      );
      if (eqRows.length > 0) {
        const { rows: cntRows } = await client.query(
          `SELECT COALESCE(SUM(quantity), 0)::int AS total
             FROM user_inventory
            WHERE user_id = $1 AND item_id = $2`,
          [userId, inv.item_id],
        );
        const totalQty = (cntRows[0] as { total: number }).total;
        if (totalQty <= 1) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Unequip this item before selling" });
          return;
        }
      }
    }

    // Step 3: Validate tradeable
    if (!inv.is_tradeable) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This item cannot be traded or sold" });
      return;
    }
    if (inv.sell_value === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This item cannot be sold" });
      return;
    }

    // Step 4: Check daily cap
    await ensureUserCoins(client, userId);
    await dailyResetCheck(client, userId);
    const { rows: capRows } = await client.query(
      `SELECT daily_coins_earned FROM user_coins WHERE user_id = $1`,
      [userId],
    );
    const dailyEarned = (capRows[0] as { daily_coins_earned: number }).daily_coins_earned;
    if (dailyEarned >= DAILY_EARN_CAP) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Daily coin limit reached — resets at midnight UTC" });
      return;
    }

    // Step 5: Deduct item from bag
    if (inv.quantity <= 1) {
      await client.query(`DELETE FROM user_inventory WHERE id = $1`, [inventory_id]);
    } else {
      await client.query(
        `UPDATE user_inventory SET quantity = quantity - 1 WHERE id = $1`,
        [inventory_id],
      );
    }

    // Step 6: Credit coins
    const { credited, newBalance, dailyEarned: newDailyEarned } = await creditCoins(
      client,
      userId,
      inv.sell_value,
      "item_sale",
      String(inv.item_id),
      `Sold: ${inv.name}`,
    );

    await client.query("COMMIT");
    res.json({ new_balance: newBalance, coins_earned: credited, daily_coins_earned: newDailyEarned });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
